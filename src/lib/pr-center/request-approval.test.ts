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
  role: "RTRDA_PR",
};
const requesterActor: PrCenterActor = {
  id: "requester-1",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "RTRDA_ALL_USER",
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
  requester: { roles: [{ id: "all-user-grant" }] },
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
  it("gives RTRDA_BORD the same scoped task-approval access as RTRDA_PR", async () => {
    const boardActor: PrCenterActor = {
      ...requesterActor,
      id: "board-user",
      role: "RTRDA_BORD",
    };

    mockPrisma.prTask.findMany.mockResolvedValue([]);
    await expect(listApprovalQueue(boardActor)).resolves.toEqual([]);
    expect(mockPrisma.prTask.findMany).toHaveBeenCalled();
  });

  it("gives RTRDA_BORD the same cross-user request scope as RTRDA_PR", async () => {
    const boardActor: PrCenterActor = {
      ...requesterActor,
      id: "board-user",
      role: "RTRDA_BORD",
    };
    mockPrisma.prRequest.findMany.mockResolvedValue([]);

    await listRequests(boardActor);

    expect(mockPrisma.prRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org-1",
          OR: [
            { requesterId: "board-user" },
            { tasks: { some: { ownerId: "board-user" } } },
            { departmentId: "dept-1" },
          ],
        },
      }),
    );
  });

  it("shows owners their requests and PR/BORD/admin requests in their granted scope", async () => {
    mockPrisma.prRequest.findMany.mockResolvedValue([]);

    await listRequests(requesterActor);
    expect(mockPrisma.prRequest.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          OR: [
            { requesterId: requesterActor.id },
            { tasks: { some: { ownerId: requesterActor.id } } },
          ],
        }),
        include: expect.objectContaining({
          requester: { select: { displayName: true } },
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
        OR: [
          { requesterId: prActor.id },
          { tasks: { some: { ownerId: prActor.id } } },
          { departmentId: "dept-1" },
        ],
      }),
    );
    expect(prWhere).not.toHaveProperty("requesterId");

    const adminActor: PrCenterActor = {
      ...prActor,
      id: "admin-user",
      role: "RTRDA_ADMIN",
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
      roleGrants: [{ role: "RTRDA_ADMIN", departmentId: "dept-2" }],
    };
    await listRequests(departmentAdmin);
    expect(mockPrisma.prRequest.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          OR: [
            { requesterId: departmentAdmin.id },
            { tasks: { some: { ownerId: departmentAdmin.id } } },
            { departmentId: "dept-2" },
          ],
        }),
      }),
    );
  });

  it("returns only the assigned task to a non-requester task owner", async () => {
    const assignedOwner: PrCenterActor = { ...requesterActor, id: "assigned-owner" };
    const assignedTask = { id: "owned-task", ownerId: assignedOwner.id };
    const siblingTask = { id: "sibling-task", ownerId: "another-owner" };
    mockPrisma.prRequest.findMany.mockResolvedValue([
      {
        ...requestRecord,
        title: "Private campaign",
        requester: { displayName: "Private requester" },
        department: { name: "Private department" },
        priorityReason: "Sensitive request detail",
        revisions: [{ objective: "Private objective" }],
        sources: [{ url: "https://private.example.org/source" }],
        statusHistory: [{ toState: "REJECTED", reason: "Private reason" }],
        attachments: [{ id: "private-attachment" }],
        tasks: [assignedTask, siblingTask],
      },
    ]);

    const requests = await listRequests(assignedOwner);
    const assignedRequest = requests[0];

    expect(assignedRequest).toMatchObject({
      id: requestRecord.id,
      status: requestRecord.status,
      requesterId: "",
      sources: [],
      tasks: [assignedTask],
      assignedTaskOnly: true,
    });
    expect(assignedRequest).not.toHaveProperty("title");
    expect(assignedRequest).not.toHaveProperty("requester");
    expect(assignedRequest).not.toHaveProperty("department");
    expect(assignedRequest).not.toHaveProperty("priorityReason");
    expect(assignedRequest).not.toHaveProperty("revisions");
    expect(assignedRequest).not.toHaveProperty("statusHistory");
    expect(assignedRequest).not.toHaveProperty("attachments");
  });

  it("lets BORD open another user's request within its grant scope", async () => {
    const unrelatedActor: PrCenterActor = {
      ...prActor,
      id: "unrelated-user",
      role: "RTRDA_BORD",
    };
    mockPrisma.prRequest.findFirst.mockResolvedValueOnce(requestRecord);

    await expect(requestDetail(unrelatedActor, requestRecord.id)).resolves.toEqual(
      requestRecord,
    );
    expect(mockPrisma.prRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: requestRecord.id,
          organizationId: unrelatedActor.organizationId,
          OR: [{ requesterId: unrelatedActor.id }, { departmentId: "dept-1" }],
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
              target: "request:request-1",
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

  it("allows RTRDA_PR, RTRDA_BORD, and RTRDA_ADMIN to list pending requests", async () => {
    await expect(listRequestApprovalQueue(requesterActor)).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
    const boardActor: PrCenterActor = {
      ...requesterActor,
      id: "board-user",
      role: "RTRDA_BORD",
    };
    mockPrisma.prRequest.findMany.mockResolvedValue([]);
    await expect(listRequestApprovalQueue(boardActor)).resolves.toEqual([]);
    const adminActor: PrCenterActor = {
      ...prActor,
      id: "admin-user",
      role: "RTRDA_ADMIN",
    };
    mockPrisma.prRequest.findMany.mockResolvedValue([]);
    await expect(listRequestApprovalQueue(adminActor)).resolves.toEqual([]);
    expect(mockPrisma.prRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          status: "SUBMITTED",
        }),
      }),
    );
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
          OR: [{ requesterId: prActor.id }, { departmentId: "dept-2" }],
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
          OR: [{ requesterId: prActor.id }, { departmentId: "dept-1" }],
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
    mockPrisma.prUserRole.findMany
      .mockResolvedValueOnce([{ userId: "pr-recipient" }])
      .mockResolvedValueOnce([{ userId: "pr-recipient" }, { userId: "bord-recipient" }]);

    await transitionRequest(requesterActor, requestRecord.id, 1, "SUBMITTED");

    expect(mockPrisma.prUserRole.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: requestRecord.organizationId,
          role: { in: ["RTRDA_PR", "RTRDA_BORD"] },
          OR: [{ departmentId: requestRecord.departmentId }, { departmentId: null }],
        }),
      }),
    );
    expect(mockPrisma.prUserRole.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: requestRecord.organizationId,
          role: { in: ["RTRDA_PR", "RTRDA_BORD", "RTRDA_ADMIN"] },
          OR: [{ departmentId: requestRecord.departmentId }, { departmentId: null }],
        }),
      }),
    );
    expect(mockPrisma.prNotification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ userId: "requester-1", target: "request:request-1" }),
        expect.objectContaining({ userId: "pr-recipient", target: "request:request-1" }),
        expect.objectContaining({
          userId: "bord-recipient",
          target: "request:request-1",
        }),
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

  it("records approval, notifies scoped BORD users, and routes the accepted request to PR Operations and requester", async () => {
    mockPrisma.prUserRole.findMany
      .mockResolvedValueOnce([{ userId: "pr-recipient" }])
      .mockResolvedValueOnce([{ userId: "pr-recipient" }, { userId: "bord-recipient" }]);
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
          target: "request:request-1",
          title: "Request approved",
        }),
        expect.objectContaining({
          userId: "pr-recipient",
          target: "request:request-1",
          title: "Approved request ready for PR assignment",
        }),
        expect.objectContaining({
          userId: "bord-recipient",
          target: "request:request-1",
          title: "Request approved",
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

  it("allows RTRDA_ADMIN to decide request intake", async () => {
    const adminActor: PrCenterActor = {
      ...prActor,
      id: "admin-user",
      role: "RTRDA_ADMIN",
    };

    await recordRequestDecision(adminActor, requestRecord.id, 2, {
      decision: "APPROVED",
    });

    expect(mockPrisma.prRequest.updateMany).toHaveBeenCalledWith({
      where: { id: requestRecord.id, version: 2, status: "SUBMITTED" },
      data: { status: "APPROVED", version: { increment: 1 } },
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
          target: "request:request-1",
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
