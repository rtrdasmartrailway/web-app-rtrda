import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    prRequest: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    prRequestRevision: { create: vi.fn() },
    prRequestSource: { deleteMany: vi.fn(), createMany: vi.fn() },
    prUserRole: { findMany: vi.fn() },
    prTask: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
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
  listApprovalQueue,
  listRequests,
  requestDetail,
  recordRequestDecision,
  transitionRequest,
  updateRequestDraft,
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
  it("exposes the task approval queue to scoped APPROVER grants", async () => {
    const approver: PrCenterActor = {
      ...requesterActor,
      role: "APPROVER",
    };
    mockPrisma.prTask.findMany.mockResolvedValue([]);

    await listApprovalQueue(approver);

    expect(mockPrisma.prTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          request: expect.objectContaining({
            organizationId: approver.organizationId,
            OR: [{ departmentId: "dept-1" }],
          }),
        }),
      }),
    );
  });

  it("shows owners their requests and PR/admin users requests in their granted scope", async () => {
    mockPrisma.prRequest.findMany.mockResolvedValue([]);

    await listRequests(requesterActor);
    expect(mockPrisma.prRequest.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          OR: [{ requesterId: requesterActor.id }],
        }),
        include: expect.objectContaining({
          statusHistory: expect.objectContaining({
            where: { toState: { in: ["REJECTED", "APPROVED"] } },
            select: expect.objectContaining({ reason: true, toState: true }),
          }),
        }),
      }),
    );

    await listRequests(prActor);
    const prWhere = mockPrisma.prRequest.findMany.mock.calls.at(-1)?.[0].where;
    expect(prWhere).toEqual(
      expect.objectContaining({
        organizationId: "org-1",
        OR: [{ requesterId: prActor.id }, { departmentId: "dept-1" }],
      }),
    );
    expect(prWhere).not.toHaveProperty("requesterId");

    const adminActor: PrCenterActor = {
      ...prActor,
      id: "admin-user",
      role: "SCOPED_ADMINISTRATOR",
    };
    await listRequests(adminActor);
    expect(mockPrisma.prRequest.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1" },
        include: expect.objectContaining({
          statusHistory: expect.objectContaining({
            where: { toState: { in: ["REJECTED", "APPROVED"] } },
            select: expect.objectContaining({ reason: true, toState: true }),
          }),
        }),
      }),
    );

    const departmentAdmin: PrCenterActor = {
      ...adminActor,
      roleGrants: [{ role: "SCOPED_ADMINISTRATOR", departmentId: "dept-2" }],
    };
    await listRequests(departmentAdmin);
    expect(mockPrisma.prRequest.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          OR: [{ requesterId: departmentAdmin.id }, { departmentId: "dept-2" }],
        }),
      }),
    );
  });

  it("does not let an unrelated non-owner role open another user's request", async () => {
    const unrelatedActor: PrCenterActor = {
      ...prActor,
      id: "unrelated-user",
      role: "APPROVER",
    };
    mockPrisma.prRequest.findFirst.mockResolvedValueOnce(null);

    await expect(requestDetail(unrelatedActor, requestRecord.id)).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
    expect(mockPrisma.prRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: requestRecord.id,
          organizationId: unrelatedActor.organizationId,
          OR: [{ requesterId: unrelatedActor.id }],
        }),
      }),
    );
  });

  it("returns the persisted rejection comment to the request owner", async () => {
    const requestWithReason = {
      ...requestRecord,
      status: "REJECTED",
      statusHistory: [{ reason: "Missing required information" }],
    };
    mockPrisma.prRequest.findFirst.mockResolvedValueOnce(requestWithReason);

    const result = await requestDetail(requesterActor, requestRecord.id);

    expect(result.statusHistory[0]?.reason).toBe("Missing required information");
    expect(mockPrisma.prRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: [{ requesterId: requesterActor.id }] }),
        include: expect.objectContaining({
          statusHistory: expect.objectContaining({
            where: { toState: { in: ["REJECTED", "APPROVED"] } },
            select: expect.objectContaining({ reason: true, toState: true }),
          }),
        }),
      }),
    );
  });

  it.each(["DRAFT", "SUBMITTED"] as const)(
    "lets the request owner update an editable %s request with version/audit protection",
    async (status) => {
      mockPrisma.prRequest.findFirst.mockResolvedValueOnce({
        ...requestRecord,
        status,
        revisions: [{ revisionNumber: 1 }],
      });
      mockPrisma.prRequest.findUniqueOrThrow.mockResolvedValueOnce({
        ...requestRecord,
        status: "DRAFT",
        version: 3,
      });

      await updateRequestDraft(
        requesterActor,
        requestRecord.id,
        2,
        {
          type: "PR",
          title: "Updated title",
          objective: "Updated objective",
          audience: "Updated audience",
          sourceUrls: ["https://example.test/source"],
        },
        "edit-correlation",
      );

      expect(mockPrisma.prRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: requestRecord.id, version: 2, status },
          data: expect.objectContaining({
            ...(status === "DRAFT" ? {} : { status: "DRAFT" }),
            version: { increment: 1 },
          }),
        }),
      );
      expect(mockPrisma.prRequestRevision.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requestId: requestRecord.id,
            revisionNumber: 2,
            title: "Updated title",
            objective: "Updated objective",
            audience: "Updated audience",
          }),
        }),
      );
      if (status === "SUBMITTED") {
        expect(mockPrisma.prNotification.createMany).toHaveBeenCalledWith({
          data: expect.arrayContaining([
            expect.objectContaining({
              userId: "pr-recipient",
              target: "approvals",
              title: "Request amended; resubmission required",
            }),
          ]),
        });
      }
      expect(mockPrisma.prAuditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "request.amended",
            entityId: requestRecord.id,
          }),
        }),
      );
    },
  );

  it.each(["REJECTED", "WITHDRAWN"] as const)(
    "reopens the original %s request and its cancelled task as a new draft revision",
    async (status) => {
      mockPrisma.prRequest.findFirst.mockResolvedValueOnce({
        ...requestRecord,
        status,
        version: 4,
        revisions: [{ revisionNumber: 2 }],
        tasks: [{ id: "task-1", status: "CANCELLED", version: 3 }],
      });
      mockPrisma.prTask.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.prRequest.findUniqueOrThrow.mockResolvedValueOnce({
        ...requestRecord,
        status: "DRAFT",
        version: 5,
        revisions: [{ revisionNumber: 3 }],
        tasks: [{ id: "task-1", status: "DRAFT", version: 4 }],
      });

      const reopened = await updateRequestDraft(requesterActor, requestRecord.id, 4, {
        type: "PR",
        title: "Updated after decision",
        objective: "Revised objective",
        audience: "Public",
        sourceUrls: ["https://example.test/revised-source"],
      });

      expect(reopened).toMatchObject({
        id: requestRecord.id,
        requestNumber: requestRecord.requestNumber,
        status: "DRAFT",
        version: 5,
      });
      expect(mockPrisma.prRequest.updateMany).toHaveBeenCalledWith({
        where: { id: requestRecord.id, version: 4, status },
        data: expect.objectContaining({ status: "DRAFT", version: { increment: 1 } }),
      });
      expect(mockPrisma.prTask.updateMany).toHaveBeenCalledWith({
        where: { id: "task-1", status: "CANCELLED", version: 3 },
        data: { status: "DRAFT", version: { increment: 1 } },
      });
      expect(mockPrisma.prStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          requestId: requestRecord.id,
          fromState: status,
          toState: "DRAFT",
          actorId: requesterActor.id,
        }),
      });
    },
  );

  it("only lists pending requests for PR Operations; requesters and administrators are denied", async () => {
    await expect(listRequestApprovalQueue(requesterActor)).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
    const adminActor: PrCenterActor = {
      ...prActor,
      id: "admin-user",
      role: "SCOPED_ADMINISTRATOR",
    };
    await expect(listRequestApprovalQueue(adminActor)).rejects.toMatchObject({
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
          OR: [{ departmentId: "dept-2" }],
          status: "SUBMITTED",
        }),
      }),
    );
  });

  it("keeps self-submitted and task-started requests visible with explicit decision blockers", async () => {
    mockPrisma.prRequest.findMany.mockResolvedValue([
      {
        ...requestRecord,
        requesterId: prActor.id,
        tasks: [{ id: "task-self", status: "DRAFT" }],
      },
      {
        ...requestRecord,
        id: "request-started",
        tasks: [{ id: "task-started", status: "IN_PRODUCTION" }],
      },
      {
        ...requestRecord,
        id: "request-ready",
        tasks: [{ id: "task-ready", status: "DRAFT" }],
      },
    ]);

    const queue = await listRequestApprovalQueue(prActor);

    expect(mockPrisma.prRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "SUBMITTED",
          OR: [{ departmentId: "dept-1" }],
        }),
        include: expect.objectContaining({
          revisions: expect.objectContaining({ take: 1 }),
          sources: { select: { url: true } },
          attachments: expect.objectContaining({
            where: { taskId: null },
            select: expect.objectContaining({
              file: expect.objectContaining({
                select: expect.objectContaining({
                  scanStatus: true,
                  deletedAt: true,
                }),
              }),
            }),
          }),
          statusHistory: expect.objectContaining({
            where: { toState: { in: ["APPROVED", "REJECTED"] } },
          }),
        }),
      }),
    );
    expect(queue.map((request) => request.intakeDecisionBlockedReason)).toEqual([
      "SELF_SUBMISSION",
      "TASK_WORK_ALREADY_STARTED",
      null,
    ]);
  });

  it("routes newly submitted requests to scoped PR-only intake queues", async () => {
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
    mockPrisma.prUserRole.findMany.mockResolvedValue([{ userId: "pr-recipient" }]);

    await transitionRequest(requesterActor, requestRecord.id, 1, "SUBMITTED");

    expect(mockPrisma.prUserRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: requestRecord.organizationId,
          role: "PR_OPERATIONS",
          OR: [{ departmentId: requestRecord.departmentId }, { departmentId: null }],
        }),
      }),
    );
    expect(mockPrisma.prNotification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ userId: "requester-1", target: "my-requests" }),
        expect.objectContaining({ userId: "pr-recipient", target: "approvals" }),
      ]),
    });
  });

  it("does not submit a request when no active scoped PR Operations reviewer can be notified", async () => {
    mockPrisma.prRequest.findFirst.mockResolvedValue({
      ...requestRecord,
      status: "DRAFT",
      version: 1,
    });
    mockPrisma.prUserRole.findMany.mockResolvedValue([]);

    await expect(
      transitionRequest(requesterActor, requestRecord.id, 1, "SUBMITTED"),
    ).rejects.toMatchObject({ code: "NO_INTAKE_REVIEWER", statusCode: 409 });
    expect(mockPrisma.prNotification.createMany).not.toHaveBeenCalled();
  });

  it("cancels the draft task atomically when its requester withdraws a request", async () => {
    mockPrisma.prRequest.findFirst.mockResolvedValueOnce({
      ...requestRecord,
      status: "SUBMITTED",
      version: 2,
      tasks: [{ id: "task-1", status: "DRAFT", version: 1 }],
    });
    mockPrisma.prRequest.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.prTask.updateMany.mockResolvedValue({ count: 1 });

    await transitionRequest(requesterActor, requestRecord.id, 2, "WITHDRAWN");

    expect(mockPrisma.prTask.updateMany).toHaveBeenCalledWith({
      where: { id: "task-1", status: "DRAFT", version: 1 },
      data: { status: "CANCELLED", version: { increment: 1 } },
    });
    expect(mockPrisma.prStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskId: "task-1",
        fromState: "DRAFT",
        toState: "CANCELLED",
        actorId: requesterActor.id,
      }),
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

  it("stores an optional approval comment in history, audit, and requester notification", async () => {
    await recordRequestDecision(prActor, requestRecord.id, 2, {
      decision: "APPROVED",
      reason: "Complete and ready for planning",
    });

    expect(mockPrisma.prStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestId: requestRecord.id,
        toState: "APPROVED",
        reason: "Complete and ready for planning",
      }),
    });
    expect(mockPrisma.prNotification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          userId: requesterActor.id,
          body: expect.stringContaining("Complete and ready for planning"),
        }),
      ]),
    });
    expect(mockPrisma.prOutboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "pr.request.approved",
          payload: expect.objectContaining({ reason: "Complete and ready for planning" }),
        }),
      }),
    );
  });

  it("denies administrators the request-intake decision endpoint", async () => {
    const adminActor: PrCenterActor = {
      ...prActor,
      id: "admin-user",
      role: "SCOPED_ADMINISTRATOR",
    };
    await expect(
      recordRequestDecision(adminActor, requestRecord.id, 2, { decision: "APPROVED" }),
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    expect(mockPrisma.prRequest.findFirst).not.toHaveBeenCalled();
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

    expect(mockPrisma.prStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestId: requestRecord.id,
        fromState: "SUBMITTED",
        toState: "REJECTED",
        reason: "Missing required information",
        actorId: prActor.id,
      }),
    });
    expect(mockPrisma.prNotification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          userId: requesterActor.id,
          target: "my-requests",
          body: expect.stringContaining("Missing required information"),
        }),
      ]),
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
