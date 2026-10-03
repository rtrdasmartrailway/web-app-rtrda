import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    prRequest: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    prUserRole: { findMany: vi.fn() },
    prTask: { findFirst: vi.fn(), updateMany: vi.fn() },
    prCenterUser: { findFirst: vi.fn() },
    prStatusHistory: { create: vi.fn() },
    prNotification: { createMany: vi.fn() },
    prAuditEvent: { create: vi.fn() },
    prOutboxEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  mockPrisma.$transaction.mockImplementation((callback) => callback(mockPrisma));
  return { mockPrisma };
});

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));

import {
  listRequestApprovalQueue,
  recordRequestDecision,
  transitionRequest,
  transitionTask,
  updateTaskAssignment,
  type PrCenterActor,
} from "./service";

const prActor: PrCenterActor = {
  id: "pr-user",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "PR_OPERATIONS",
};
const requesterActor: PrCenterActor = {
  id: "requester-1",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "REQUESTER",
};
const requestRecord = {
  id: "request-1",
  organizationId: "org-1",
  departmentId: "dept-1",
  requesterId: "requester-1",
  requestNumber: "PR-2026-00000001",
  title: "Test request",
  status: "SUBMITTED",
  version: 2,
  tasks: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation((callback) => callback(mockPrisma));
  mockPrisma.prRequest.findFirst.mockResolvedValue(requestRecord);
  mockPrisma.prRequest.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.prRequest.findUniqueOrThrow.mockResolvedValue({
    ...requestRecord,
    status: "APPROVED",
    version: 3,
  });
  mockPrisma.prUserRole.findMany.mockResolvedValue([{ userId: "pr-recipient" }]);
});

describe("request intake approval", () => {
  it("only lists pending requests for PR or administrator approvers", async () => {
    await expect(listRequestApprovalQueue(requesterActor)).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
    expect(mockPrisma.prRequest.findMany).not.toHaveBeenCalled();
  });

  it("uses the assigned role scope instead of the user's home department", async () => {
    mockPrisma.prRequest.findMany.mockResolvedValue([]);
    await listRequestApprovalQueue({ ...prActor, scopeDepartmentId: null });
    expect(mockPrisma.prRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ departmentId: "dept-1" }),
      }),
    );

    mockPrisma.prRequest.findMany.mockClear();
    await listRequestApprovalQueue({ ...prActor, scopeDepartmentId: "dept-2" });
    expect(mockPrisma.prRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          departmentId: "dept-2",
          status: "SUBMITTED",
          requesterId: { not: prActor.id },
          tasks: { every: { status: "DRAFT" } },
        }),
      }),
    );
  });

  it("routes newly submitted requests to scoped PR and administrator approval queues", async () => {
    mockPrisma.prRequest.findFirst.mockResolvedValue({
      ...requestRecord,
      status: "DRAFT",
      version: 1,
    });
    mockPrisma.prRequest.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.prRequest.findUniqueOrThrow.mockResolvedValue({
      ...requestRecord,
      status: "SUBMITTED",
      version: 2,
    });
    mockPrisma.prUserRole.findMany.mockResolvedValue([
      { userId: "pr-recipient" },
      { userId: "admin-recipient" },
    ]);

    await transitionRequest(requesterActor, requestRecord.id, 1, "SUBMITTED");

    expect(mockPrisma.prUserRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: requestRecord.organizationId,
          role: { in: ["PR_OPERATIONS", "SCOPED_ADMINISTRATOR"] },
          OR: [{ departmentId: requestRecord.departmentId }, { departmentId: null }],
        }),
      }),
    );
    expect(mockPrisma.prNotification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ userId: "requester-1", target: "my-requests" }),
        expect.objectContaining({ userId: "pr-recipient", target: "approvals" }),
        expect.objectContaining({ userId: "admin-recipient", target: "approvals" }),
      ]),
    });
  });

  it("records approval and routes the accepted request to PR Operations and requester", async () => {
    await recordRequestDecision(prActor, requestRecord.id, 2, {
      decision: "APPROVED",
    });

    expect(mockPrisma.prRequest.updateMany).toHaveBeenCalledWith({
      where: { id: requestRecord.id, version: 2, status: "SUBMITTED" },
      data: { status: "APPROVED", version: { increment: 1 } },
    });
    expect(mockPrisma.prNotification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          userId: "requester-1",
          target: "my-requests",
          title: "Request approved",
        }),
        expect.objectContaining({
          userId: "pr-recipient",
          target: "requests",
          title: "Approved request ready for PR assignment",
        }),
      ]),
    });
    expect(mockPrisma.prStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestId: requestRecord.id,
        fromState: "SUBMITTED",
        toState: "APPROVED",
        actorId: prActor.id,
      }),
    });
  });

  it("requires a reason before rejecting a submitted request", async () => {
    await expect(
      recordRequestDecision(prActor, requestRecord.id, 2, { decision: "REJECTED" }),
    ).rejects.toMatchObject({ code: "REASON_REQUIRED", statusCode: 422 });
    expect(mockPrisma.prRequest.updateMany).not.toHaveBeenCalled();
  });

  it("rejects the request and cancels its untouched draft task with a reason", async () => {
    mockPrisma.prRequest.findFirst.mockResolvedValue({
      ...requestRecord,
      tasks: [{ id: "task-1", status: "DRAFT", version: 4 }],
    });
    mockPrisma.prTask.updateMany.mockResolvedValue({ count: 1 });

    await recordRequestDecision(prActor, requestRecord.id, 2, {
      decision: "REJECTED",
      reason: "Missing required information",
    });

    expect(mockPrisma.prTask.updateMany).toHaveBeenCalledWith({
      where: { id: "task-1", status: "DRAFT", version: 4 },
      data: { status: "CANCELLED", version: { increment: 1 } },
    });
    expect(mockPrisma.prStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskId: "task-1",
        fromState: "DRAFT",
        toState: "CANCELLED",
        reason: "Missing required information",
      }),
    });
  });

  it("does not let task work or assignment begin before request approval", async () => {
    mockPrisma.prTask.findFirst.mockResolvedValue({
      id: "task-1",
      requestId: requestRecord.id,
      status: "DRAFT",
      version: 1,
      request: { status: "SUBMITTED", departmentId: "dept-1" },
    });
    await expect(
      transitionTask(prActor, "task-1", 1, "COMMUNICATION_PLANNING", undefined),
    ).rejects.toMatchObject({ code: "REQUEST_NOT_APPROVED", statusCode: 409 });
    await expect(
      updateTaskAssignment(prActor, "task-1", 1, { ownerId: "owner-1", dueAt: null }),
    ).rejects.toMatchObject({ code: "REQUEST_NOT_APPROVED", statusCode: 409 });
    expect(mockPrisma.prTask.updateMany).not.toHaveBeenCalled();
  });

  it("blocks requesters and self-approval from deciding a request", async () => {
    await expect(
      recordRequestDecision(requesterActor, requestRecord.id, 2, {
        decision: "APPROVED",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
    await expect(
      recordRequestDecision(
        { ...prActor, id: requestRecord.requesterId },
        requestRecord.id,
        2,
        { decision: "APPROVED" },
      ),
    ).rejects.toMatchObject({ code: "SELF_APPROVAL_BLOCKED", statusCode: 403 });
    expect(mockPrisma.prRequest.updateMany).not.toHaveBeenCalled();
  });
});
