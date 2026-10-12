import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => {
  const prisma = {
    prTask: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    prTaskFactCheck: { findFirst: vi.fn() },
    prApproval: { findFirst: vi.fn(), create: vi.fn() },
    prSchedule: { findMany: vi.fn() },
    prStatusHistory: { create: vi.fn() },
    prAuditEvent: { create: vi.fn() },
    prOutboxEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((callback) => callback(prisma));
  return { prisma };
});

vi.mock("@/lib/db/client", () => ({ prisma }));

import {
  listApprovalQueue,
  recordApprovalDecision,
  transitionTask,
  type PrCenterActor,
} from "./service";

const approvalPolicy = JSON.stringify({
  version: "test-policy-v1",
  approvalReference: "OWNER-APPROVED-TEST-POLICY",
  effectiveAt: "2026-01-01T00:00:00.000Z",
  stages: [
    {
      status: "SOURCE_FACT_CHECK",
      required: true,
      roles: ["RTRDA_PR"],
      departmentScope: "TASK_DEPARTMENT",
    },
    {
      status: "TECHNICAL_REVIEW",
      required: true,
      roles: ["RTRDA_PR", "RTRDA_BORD"],
      departmentScope: "TASK_DEPARTMENT",
      condition: "TECHNICAL_REVIEW_REQUIRED",
    },
    {
      status: "PR_EDITORIAL_REVIEW",
      required: true,
      roles: ["RTRDA_PR"],
      departmentScope: "TASK_DEPARTMENT",
    },
    {
      status: "MANAGEMENT_APPROVAL",
      required: true,
      roles: ["RTRDA_BORD"],
      departmentScope: "TASK_DEPARTMENT",
      condition: "MANAGEMENT_APPROVAL_REQUIRED",
    },
  ],
});

const prActor: PrCenterActor = {
  id: "pr-reviewer",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "RTRDA_PR",
};
const boardActor: PrCenterActor = {
  id: "board-reviewer",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "RTRDA_BORD",
};

const completeEditorialChecklist = {
  message: true,
  language: true,
  format: true,
  appropriateness: true,
};

const taskAt = (status: string, version = 4, requirements = {}) => ({
  id: "task-1",
  requestId: "request-1",
  ownerId: "task-owner",
  status,
  version,
  technicalReviewRequired: true,
  managementApprovalRequired: true,
  request: {
    requesterId: "requester-1",
    departmentId: "dept-1",
    status: "APPROVED",
  },
  revisions: [{ revisionNumber: 3 }],
  ...requirements,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PR_CENTER_APPROVAL_POLICY_JSON", approvalPolicy);
  prisma.$transaction.mockImplementation((callback) => callback(prisma));
  prisma.prTask.updateMany.mockResolvedValue({ count: 1 });
  prisma.prTask.findUniqueOrThrow.mockResolvedValue({ id: "task-1" });
  prisma.prTaskFactCheck.findFirst.mockResolvedValue({
    items: [{ result: "VERIFIED" }],
  });
  prisma.prApproval.findFirst.mockResolvedValue(null);
  prisma.prApproval.create.mockResolvedValue({ id: "approval-1" });
  prisma.prStatusHistory.create.mockResolvedValue({});
  prisma.prAuditEvent.create.mockResolvedValue({});
  prisma.prOutboxEvent.create.mockResolvedValue({});
});

describe("task-stage approval flow", () => {
  it("enters only the first active approval stage from production", async () => {
    const task = taskAt("IN_PRODUCTION");
    prisma.prTask.findFirst.mockResolvedValue(task);

    await transitionTask(prActor, task.id, task.version, "SOURCE_FACT_CHECK", undefined);

    expect(prisma.prTask.updateMany).toHaveBeenCalledWith({
      where: { id: task.id, version: task.version },
      data: { status: "SOURCE_FACT_CHECK", version: { increment: 1 } },
    });
  });

  it("advances in order and skips only the task stages not requested by PR", async () => {
    const sequence: Array<
      [string, PrCenterActor, string, typeof completeEditorialChecklist?]
    > = [
      ["SOURCE_FACT_CHECK", prActor, "TECHNICAL_REVIEW"],
      ["TECHNICAL_REVIEW", boardActor, "PR_EDITORIAL_REVIEW"],
      ["PR_EDITORIAL_REVIEW", prActor, "MANAGEMENT_APPROVAL", completeEditorialChecklist],
      ["MANAGEMENT_APPROVAL", boardActor, "APPROVED"],
    ];

    for (const [status, actor, nextStatus, reviewChecklist] of sequence) {
      const task = taskAt(status);
      prisma.prTask.findFirst.mockResolvedValueOnce(task);
      const result = await recordApprovalDecision(actor, task.id, task.version, {
        decision: "APPROVED",
        ...(reviewChecklist ? { reviewChecklist } : {}),
      });
      expect(result.id).toBe("approval-1");
      expect(prisma.prTask.updateMany).toHaveBeenLastCalledWith({
        where: { id: task.id, version: task.version },
        data: { status: nextStatus, version: { increment: 1 } },
      });
      expect(prisma.prApproval.create).toHaveBeenLastCalledWith({
        data: expect.objectContaining({
          taskId: task.id,
          taskRevision: 3,
          stage: status,
          decision: "APPROVED",
          approvalPolicyVersion: "test-policy-v1",
          ...(reviewChecklist ? { reviewChecklist } : {}),
        }),
      });
      if (reviewChecklist)
        expect(prisma.prAuditEvent.create).toHaveBeenLastCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              after: expect.objectContaining({ reviewChecklist }),
            }),
          }),
        );
    }
  });

  it("requires a complete structured editorial checklist before PR approval", async () => {
    const task = taskAt("PR_EDITORIAL_REVIEW");
    prisma.prTask.findFirst.mockResolvedValue(task);

    await expect(
      recordApprovalDecision(prActor, task.id, task.version, { decision: "APPROVED" }),
    ).rejects.toMatchObject({
      code: "EDITORIAL_REVIEW_CHECKLIST_REQUIRED",
      statusCode: 422,
    });
    await expect(
      recordApprovalDecision(prActor, task.id, task.version, {
        decision: "APPROVED",
        reviewChecklist: { ...completeEditorialChecklist, format: false },
      }),
    ).rejects.toMatchObject({
      code: "EDITORIAL_REVIEW_CHECKLIST_INCOMPLETE",
      statusCode: 422,
    });
    expect(prisma.prTask.updateMany).not.toHaveBeenCalled();
  });

  it("records failed editorial criteria with the revision request", async () => {
    const task = taskAt("PR_EDITORIAL_REVIEW");
    const checklist = { ...completeEditorialChecklist, language: false };
    prisma.prTask.findFirst.mockResolvedValue(task);

    await recordApprovalDecision(prActor, task.id, task.version, {
      decision: "REVISION_REQUIRED",
      comment: "Please revise the language",
      reviewChecklist: checklist,
    });

    expect(prisma.prApproval.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stage: "PR_EDITORIAL_REVIEW",
        decision: "REVISION_REQUIRED",
        reviewChecklist: checklist,
      }),
    });
    expect(prisma.prTask.updateMany).toHaveBeenCalledWith({
      where: { id: task.id, version: task.version },
      data: { status: "REVISION_REQUIRED", version: { increment: 1 } },
    });
  });

  it("skips conditional review stages when PR did not select them", async () => {
    const task = taskAt("SOURCE_FACT_CHECK", 4, {
      technicalReviewRequired: false,
      managementApprovalRequired: false,
    });
    prisma.prTask.findFirst.mockResolvedValue(task);

    await recordApprovalDecision(prActor, task.id, task.version, {
      decision: "APPROVED",
    });

    expect(prisma.prTask.updateMany).toHaveBeenCalledWith({
      where: { id: task.id, version: task.version },
      data: { status: "PR_EDITORIAL_REVIEW", version: { increment: 1 } },
    });
  });

  it("blocks source approval until current-revision claims are all VERIFIED", async () => {
    const task = taskAt("SOURCE_FACT_CHECK");
    prisma.prTask.findFirst.mockResolvedValue(task);
    prisma.prTaskFactCheck.findFirst.mockResolvedValue({
      items: [{ result: "VERIFIED" }, { result: "NEEDS_EVIDENCE" }],
    });

    await expect(
      recordApprovalDecision(prActor, task.id, task.version, { decision: "APPROVED" }),
    ).rejects.toMatchObject({ code: "FACT_CHECK_INCOMPLETE", statusCode: 422 });
    expect(prisma.prTask.updateMany).not.toHaveBeenCalled();
    expect(prisma.prApproval.create).not.toHaveBeenCalled();
  });

  it("denies BORD from PR editorial review and blocks self-approval", async () => {
    const task = taskAt("PR_EDITORIAL_REVIEW");
    prisma.prTask.findFirst.mockResolvedValue(task);

    await expect(
      recordApprovalDecision(boardActor, task.id, task.version, { decision: "APPROVED" }),
    ).rejects.toMatchObject({ code: "APPROVAL_AUTHORITY_MISMATCH", statusCode: 403 });
    expect(prisma.prTask.updateMany).not.toHaveBeenCalled();

    prisma.prTask.findFirst.mockResolvedValue(
      taskAt("PR_EDITORIAL_REVIEW", 4, { ownerId: prActor.id }),
    );
    await expect(
      recordApprovalDecision(prActor, task.id, task.version, { decision: "APPROVED" }),
    ).rejects.toMatchObject({ code: "SELF_APPROVAL_BLOCKED", statusCode: 403 });
  });

  it("reserves conditional management approval for the executive BORD role", async () => {
    const task = taskAt("MANAGEMENT_APPROVAL");
    prisma.prTask.findFirst.mockResolvedValue(task);

    await expect(
      recordApprovalDecision(prActor, task.id, task.version, { decision: "APPROVED" }),
    ).rejects.toMatchObject({ code: "APPROVAL_AUTHORITY_MISMATCH", statusCode: 403 });
    expect(prisma.prTask.updateMany).not.toHaveBeenCalled();

    await recordApprovalDecision(boardActor, task.id, task.version, {
      decision: "APPROVED",
    });
    expect(prisma.prTask.updateMany).toHaveBeenCalledWith({
      where: { id: task.id, version: task.version },
      data: { status: "APPROVED", version: { increment: 1 } },
    });
  });

  it("closes a published task after every scheduled channel has evidence", async () => {
    const task = taskAt("PUBLISHED");
    prisma.prTask.findFirst.mockResolvedValue(task);
    prisma.prTask.findUniqueOrThrow.mockResolvedValue({ id: task.id, status: "CLOSED" });
    prisma.prSchedule.findMany.mockResolvedValue([
      { publishedAt: new Date("2026-10-01T00:00:00.000Z") },
      { publishedAt: new Date("2026-10-02T00:00:00.000Z") },
    ]);

    const closed = await transitionTask(
      prActor,
      task.id,
      task.version,
      "CLOSED",
      undefined,
    );

    expect(closed.status).toBe("CLOSED");
    expect(prisma.prSchedule.findMany).toHaveBeenCalledWith({
      where: { taskId: task.id },
      select: { publishedAt: true },
    });
    expect(prisma.prTask.updateMany).toHaveBeenCalledWith({
      where: { id: task.id, version: task.version },
      data: { status: "CLOSED", version: { increment: 1 } },
    });
  });

  it("requires publication evidence for every channel before closing", async () => {
    const task = taskAt("PUBLISHED");
    prisma.prTask.findFirst.mockResolvedValue(task);
    prisma.prSchedule.findMany.mockResolvedValue([
      { publishedAt: new Date("2026-10-01T00:00:00.000Z") },
      { publishedAt: null },
    ]);

    await expect(
      transitionTask(prActor, task.id, task.version, "CLOSED", undefined),
    ).rejects.toMatchObject({
      code: "PUBLICATION_EVIDENCE_INCOMPLETE",
      statusCode: 409,
    });
    expect(prisma.prTask.updateMany).not.toHaveBeenCalled();
  });

  it("lists only stages the actor may decide and excludes self-approval", async () => {
    prisma.prTask.findMany.mockResolvedValue([
      {
        ...taskAt("TECHNICAL_REVIEW"),
        request: {
          ...taskAt("TECHNICAL_REVIEW").request,
          title: "Technical review",
          sources: [],
        },
        owner: null,
        revisions: [],
      },
      {
        ...taskAt("MANAGEMENT_APPROVAL"),
        request: {
          ...taskAt("MANAGEMENT_APPROVAL").request,
          title: "Management approval",
          sources: [],
        },
        owner: null,
        revisions: [],
      },
      {
        ...taskAt("PR_EDITORIAL_REVIEW", 4, { ownerId: prActor.id }),
        request: {
          ...taskAt("PR_EDITORIAL_REVIEW").request,
          title: "Own task",
          sources: [],
        },
        owner: null,
        revisions: [],
      },
    ]);

    const queue = await listApprovalQueue(prActor);

    expect(queue.map((task) => task.status)).toEqual(["TECHNICAL_REVIEW"]);
  });
});
