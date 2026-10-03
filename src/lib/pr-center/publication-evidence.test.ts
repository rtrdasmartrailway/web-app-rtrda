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
  role: "PR_OPERATIONS" as const,
};
const channelSchedule = (id: string, channel: string) => ({
  id,
  channel,
  taskRevision: 2,
  publishedAt: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  tx.prTask.updateMany.mockResolvedValue({ count: 1 });
  tx.prSchedule.updateMany.mockResolvedValue({ count: 1 });
  tx.prSchedule.create.mockResolvedValue({ id: "schedule-new", channel: "Web" });
  tx.prStatusHistory.create.mockResolvedValue({});
  tx.prAuditEvent.create.mockResolvedValue({});
  tx.prOutboxEvent.create.mockResolvedValue({});
  prisma.prSchedule.findUnique.mockResolvedValue(null);
  prisma.prSchedule.findFirst.mockResolvedValue(null);
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
      scheduledFor: new Date("2026-10-12T08:00:00Z"),
      idempotencyKey: "web-key-0001",
    });

    expect(result.id).toBe("schedule-new");
    expect(tx.prTask.updateMany).toHaveBeenCalledWith({
      where: { id: "task", version: 4, status: "SCHEDULED" },
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

  it("rejects a second schedule for the same channel and revision", async () => {
    prisma.prTask.findFirst.mockResolvedValue(scheduledTask);
    prisma.prSchedule.findFirst.mockResolvedValue({ id: "existing" });

    await expect(
      scheduleTask(actor, "task", 4, {
        channel: "Web",
        scheduledFor: new Date("2026-10-12T08:00:00Z"),
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
      expect.objectContaining({ where: { id: "schedule-web", publishedAt: null } }),
    );
    expect(tx.prTask.updateMany).not.toHaveBeenCalled();
    expect(tx.prStatusHistory.create).not.toHaveBeenCalled();
    expect(tx.prAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "task.publication_evidence_recorded" }),
      }),
    );
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
      where: { id: "task", version: 3, status: "SCHEDULED" },
      data: { status: "PUBLISHED", version: { increment: 1 } },
    });
    expect(tx.prStatusHistory.create).toHaveBeenCalledTimes(1);
  });
});
