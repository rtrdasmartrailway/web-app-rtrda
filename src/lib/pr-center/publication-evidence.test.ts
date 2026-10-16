import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, tx } = vi.hoisted(() => {
  const tx = {
    prTask: { updateMany: vi.fn() },
    prSchedule: { updateMany: vi.fn(), create: vi.fn() },
    prStatusHistory: { create: vi.fn() },
    prAuditEvent: { create: vi.fn() },
    prOutboxEvent: { create: vi.fn() },
  };
  return {
    tx,
    prisma: {
      prTask: { findFirst: vi.fn() },
      prApproval: { findMany: vi.fn() },
      prSchedule: { findUnique: vi.fn(), findFirst: vi.fn() },
      prFileObject: { findFirst: vi.fn() },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    },
  };
});

vi.mock("@/lib/db/client", () => ({ prisma }));

import { recordPublishingEvidence, scheduleTask } from "./service";

const actor = {
  id: "actor",
  organizationId: "org",
  departmentId: null,
  role: "RTRDA_PR" as const,
};
const channelSchedule = (id: string, channel: string) => ({
  id,
  channel,
  taskRevision: 2,
  publishedAt: null,
});
const approvalPolicyJson = JSON.stringify({
  version: "test-policy-1",
  approvalReference: "TEST-POLICY",
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PR_CENTER_APPROVAL_POLICY_JSON", approvalPolicyJson);
  tx.prTask.updateMany.mockResolvedValue({ count: 1 });
  tx.prSchedule.updateMany.mockResolvedValue({ count: 1 });
  tx.prSchedule.create.mockResolvedValue({ id: "schedule-new", channel: "Web" });
  tx.prStatusHistory.create.mockResolvedValue({});
  tx.prAuditEvent.create.mockResolvedValue({});
  tx.prOutboxEvent.create.mockResolvedValue({});
  prisma.prSchedule.findUnique.mockResolvedValue(null);
  prisma.prSchedule.findFirst.mockResolvedValue(null);
  prisma.prApproval.findMany.mockResolvedValue([
    { stage: "SOURCE_FACT_CHECK" },
    { stage: "PR_EDITORIAL_REVIEW" },
  ]);
  prisma.prFileObject.findFirst.mockResolvedValue({ id: "asset" });
});

describe("scheduleTask", () => {
  const scheduledTask = {
    id: "task",
    version: 4,
    status: "SCHEDULED",
    ownerId: "owner",
    request: { sources: [{ url: "https://example.com/source" }] },
    revisions: [
      {
        revisionNumber: 2,
        finalAssetId: "asset",
        keyMessage: "Key message",
      },
    ],
  };

  it("allows a second distinct channel schedule for the same approved revision", async () => {
    prisma.prTask.findFirst.mockResolvedValue(scheduledTask);

    const result = await scheduleTask(actor, "task", 4, {
      channel: "Web",
      scheduledFor: new Date(Date.now() + 60 * 60 * 1000),
      idempotencyKey: "web-key-0001",
    });

    expect(result.id).toBe("schedule-new");
    expect(tx.prTask.updateMany).toHaveBeenCalledWith({
      where: {
        id: "task",
        version: 4,
        status: "SCHEDULED",
        request: { organizationId: "org", OR: [{ organizationId: "org" }] },
      },
      data: { channel: "Web", version: { increment: 1 } },
    });
    expect(tx.prSchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskId: "task",
        channel: "Web",
        taskRevision: 2,
      }),
    });
    expect(tx.prStatusHistory.create).not.toHaveBeenCalled();
  });

  it("rejects schedules in the past", async () => {
    prisma.prTask.findFirst.mockResolvedValue(scheduledTask);

    await expect(
      scheduleTask(actor, "task", 4, {
        channel: "Web",
        scheduledFor: new Date(Date.now() - 1000),
        idempotencyKey: "past-key-0001",
      }),
    ).rejects.toMatchObject({ code: "INVALID_SCHEDULE", statusCode: 422 });
    expect(tx.prSchedule.create).not.toHaveBeenCalled();
  });

  it("requires current-revision approval evidence for every selected review stage", async () => {
    prisma.prTask.findFirst.mockResolvedValue({
      ...scheduledTask,
      status: "APPROVED",
      technicalReviewRequired: true,
      managementApprovalRequired: true,
    });
    prisma.prApproval.findMany.mockResolvedValue([
      { stage: "SOURCE_FACT_CHECK" },
      { stage: "TECHNICAL_REVIEW" },
      { stage: "PR_EDITORIAL_REVIEW" },
    ]);

    await expect(
      scheduleTask(actor, "task", 4, {
        channel: "Web",
        scheduledFor: new Date(Date.now() + 60 * 60 * 1000),
        idempotencyKey: "missing-management-0001",
      }),
    ).rejects.toMatchObject({
      code: "PUBLICATION_APPROVALS_INCOMPLETE",
      statusCode: 422,
    });
    expect(tx.prSchedule.create).not.toHaveBeenCalled();
  });

  it("rejects a soft-deleted final asset even if its scan status was clean", async () => {
    prisma.prTask.findFirst.mockResolvedValue(scheduledTask);
    prisma.prFileObject.findFirst.mockResolvedValue(null);

    await expect(
      scheduleTask(actor, "task", 4, {
        channel: "Web",
        scheduledFor: new Date(Date.now() + 60 * 60 * 1000),
        idempotencyKey: "deleted-asset-0001",
      }),
    ).rejects.toMatchObject({ code: "PUBLICATION_GATE_INCOMPLETE", statusCode: 422 });
    expect(prisma.prFileObject.findFirst).toHaveBeenCalledWith({
      where: { id: "asset", scanStatus: "CLEAN", deletedAt: null },
      select: { id: true },
    });
  });

  it("rejects a second schedule for the same channel and revision", async () => {
    prisma.prTask.findFirst.mockResolvedValue(scheduledTask);
    prisma.prSchedule.findFirst.mockResolvedValue({ id: "existing" });

    await expect(
      scheduleTask(actor, "task", 4, {
        channel: "Web",
        scheduledFor: new Date(Date.now() + 60 * 60 * 1000),
        idempotencyKey: "web-key-0002",
      }),
    ).rejects.toMatchObject({ code: "CHANNEL_SCHEDULE_EXISTS", statusCode: 409 });
    expect(tx.prSchedule.create).not.toHaveBeenCalled();
  });
});

describe("recordPublishingEvidence", () => {
  it("records evidence for another scheduled channel after the task is published without another status transition", async () => {
    prisma.prTask.findFirst.mockResolvedValue({
      id: "task",
      version: 4,
      status: "PUBLISHED",
      schedules: [channelSchedule("schedule-web", "Web")],
    });

    const result = await recordPublishingEvidence(
      actor,
      "task",
      4,
      {
        channel: "Web",
        publishedUrl: "https://example.com/story",
        publishedReference: "web-123",
      },
      "evidence-web",
    );

    expect(result.id).toBe("schedule-web");
    expect(tx.prSchedule.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "schedule-web",
          taskId: "task",
          publishedAt: null,
          task: {
            id: "task",
            version: 4,
            status: "PUBLISHED",
            request: { organizationId: "org", OR: [{ organizationId: "org" }] },
          },
        },
      }),
    );
    expect(tx.prTask.updateMany).not.toHaveBeenCalled();
    expect(tx.prStatusHistory.create).not.toHaveBeenCalled();
    expect(tx.prAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "task.publication_evidence_recorded" }),
      }),
    );
  });

  it("rejects a publication reference already used by another schedule on the same channel", async () => {
    prisma.prTask.findFirst.mockResolvedValue({
      id: "task",
      version: 4,
      status: "PUBLISHED",
      schedules: [channelSchedule("schedule-web", "Web")],
    });
    prisma.prSchedule.findUnique.mockResolvedValue({ id: "another-schedule" });

    await expect(
      recordPublishingEvidence(actor, "task", 4, {
        channel: "Web",
        publishedUrl: "https://example.com/story",
        publishedReference: "already-used-ref",
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_PUBLICATION_REFERENCE", statusCode: 409 });
    expect(tx.prSchedule.updateMany).not.toHaveBeenCalled();
  });

  it("maps a concurrent duplicate-reference database conflict to 409", async () => {
    prisma.prTask.findFirst.mockResolvedValue({
      id: "task",
      version: 3,
      status: "SCHEDULED",
      schedules: [channelSchedule("schedule-web", "Web")],
    });
    tx.prSchedule.updateMany.mockRejectedValue(
      Object.assign(new Error("unique constraint"), { code: "P2002" }),
    );

    await expect(
      recordPublishingEvidence(actor, "task", 3, {
        channel: "Web",
        publishedUrl: "https://example.com/story",
        publishedReference: "racing-reference",
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_PUBLICATION_REFERENCE", statusCode: 409 });
  });

  it("records task PUBLISHED only for the first channel publication", async () => {
    prisma.prTask.findFirst.mockResolvedValue({
      id: "task",
      version: 3,
      status: "SCHEDULED",
      schedules: [channelSchedule("schedule-social", "Social")],
    });

    await recordPublishingEvidence(actor, "task", 3, {
      channel: "Social",
      publishedUrl: "https://example.com/post",
      publishedReference: "social-123",
    });

    expect(tx.prTask.updateMany).toHaveBeenCalledWith({
      where: {
        id: "task",
        version: 3,
        status: "SCHEDULED",
        request: { organizationId: "org", OR: [{ organizationId: "org" }] },
      },
      data: { status: "PUBLISHED", version: { increment: 1 } },
    });
    expect(tx.prStatusHistory.create).toHaveBeenCalledTimes(1);
  });
});
