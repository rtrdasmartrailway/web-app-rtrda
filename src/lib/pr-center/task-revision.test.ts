import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, tx } = vi.hoisted(() => {
  const tx = {
    prTask: { updateMany: vi.fn() },
    prTaskRevision: { create: vi.fn() },
    prSchedule: { deleteMany: vi.fn() },
    prStatusHistory: { create: vi.fn() },
    prAuditEvent: { create: vi.fn() },
    prOutboxEvent: { create: vi.fn() },
  };
  const prisma = {
    ...tx,
    prTask: { findFirst: vi.fn(), updateMany: tx.prTask.updateMany },
    prSchedule: { findMany: vi.fn() },
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  return { prisma, tx };
});

vi.mock("@/lib/db/client", () => ({ prisma }));

import { createTaskRevision } from "./service";

const actor = {
  id: "pr-user",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "PR_OPERATIONS" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation((callback) => callback(tx));
  prisma.prTask.findFirst.mockResolvedValue({
    id: "task-1",
    version: 3,
    status: "IN_PRODUCTION",
    request: { status: "APPROVED" },
    revisions: [],
  });
  tx.prTask.updateMany.mockResolvedValue({ count: 1 });
  tx.prTaskRevision.create.mockResolvedValue({
    id: "revision-1",
    revisionNumber: 1,
    body: "Approved draft content",
    keyMessage: "Safe and reliable rail",
  });
  prisma.prSchedule.findMany.mockResolvedValue([]);
  tx.prSchedule.deleteMany.mockResolvedValue({ count: 0 });
  tx.prStatusHistory.create.mockResolvedValue({});
  tx.prAuditEvent.create.mockResolvedValue({});
  tx.prOutboxEvent.create.mockResolvedValue({});
});

describe("task revision workflow", () => {
  it("does not allow content work to start before intake approval", async () => {
    prisma.prTask.findFirst.mockResolvedValueOnce({
      id: "task-1",
      version: 1,
      status: "DRAFT",
      request: { status: "SUBMITTED" },
      revisions: [],
    });

    await expect(
      createTaskRevision(actor, "task-1", 1, {
        body: "Draft body",
        keyMessage: "Key message",
      }),
    ).rejects.toMatchObject({ code: "REQUEST_NOT_APPROVED", statusCode: 409 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("requires both content and key message before saving a revision", async () => {
    await expect(
      createTaskRevision(actor, "task-1", 3, { body: "Body without key message" }),
    ).rejects.toMatchObject({ code: "INVALID_TASK_REVISION", statusCode: 422 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("persists an immutable revision and returns the task to production", async () => {
    const revision = await createTaskRevision(
      actor,
      "task-1",
      3,
      {
        body: "Approved draft content",
        keyMessage: "Safe and reliable rail",
        changeSummary: "Initial review version",
      },
      "revision-correlation",
    );

    expect(tx.prTask.updateMany).toHaveBeenCalledWith({
      where: { id: "task-1", version: 3 },
      data: { status: "IN_PRODUCTION", version: { increment: 1 } },
    });
    expect(tx.prTaskRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskId: "task-1",
        revisionNumber: 1,
        body: "Approved draft content",
        keyMessage: "Safe and reliable rail",
        immutableAt: expect.any(Date),
      }),
    });
    expect(revision.revisionNumber).toBe(1);
  });

  it("invalidates pending schedules and audits their prior dates on revision", async () => {
    prisma.prSchedule.findMany.mockResolvedValueOnce([
      {
        id: "schedule-1",
        channel: "Website",
        taskRevision: 1,
        scheduledFor: new Date("2026-10-20T08:00:00Z"),
      },
    ]);
    tx.prSchedule.deleteMany.mockResolvedValueOnce({ count: 1 });

    await createTaskRevision(
      actor,
      "task-1",
      3,
      { body: "Updated content", keyMessage: "Updated key message" },
      "revision-reschedule",
    );

    expect(tx.prSchedule.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["schedule-1"] }, publishedAt: null },
    });
    expect(tx.prAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "task.schedule_invalidated_for_revision",
          entityId: "schedule-1",
          after: expect.objectContaining({
            scheduledFor: "2026-10-20T08:00:00.000Z",
            invalidatedByRevision: 1,
          }),
        }),
      }),
    );
  });
});
