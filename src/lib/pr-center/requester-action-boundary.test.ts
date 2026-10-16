import { beforeEach, describe, expect, it, vi } from "vitest";
const { prisma } = vi.hoisted(() => {
  const prisma = {
    prContentIdea: { findFirst: vi.fn(), updateMany: vi.fn() },
    prTask: { findFirst: vi.fn(), updateMany: vi.fn() },
    prAttachment: { findFirst: vi.fn(), delete: vi.fn() },
    prNotification: { findMany: vi.fn(), updateMany: vi.fn() },
    prAuditEvent: { create: vi.fn() },
    prOutboxEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  return { prisma };
});
vi.mock("@/lib/db/client", () => ({ prisma }));
import {
  reviseIdea,
  transitionIdea,
  removeAttachment,
  listNotifications,
  markNotificationsRead,
  transitionTask,
} from "./service";
const actor = {
  id: "requester",
  organizationId: "org",
  departmentId: "dept",
  role: "RTRDA_ALL_USER" as const,
};
beforeEach(() => {
  vi.resetAllMocks();
  prisma.$transaction.mockImplementation((fn) => fn(prisma));
});
describe("Requester action boundaries", () => {
  it("cannot delete an existing attachment, even on their own request", async () => {
    await expect(removeAttachment(actor, "attachment")).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
    expect(prisma.prAttachment.findFirst).not.toHaveBeenCalled();
    expect(prisma.prAttachment.delete).not.toHaveBeenCalled();
  });
  it("cannot review or decide their own idea", async () => {
    await expect(
      transitionIdea(actor, "idea", 1, "ACCEPTED", "Fixture decision"),
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    expect(prisma.prContentIdea.findFirst).not.toHaveBeenCalled();
  });
  it("assigned ownership does not grant task transition authority", async () => {
    prisma.prTask.findFirst.mockResolvedValue({
      id: "task",
      ownerId: actor.id,
      status: "IN_PRODUCTION",
      version: 1,
      request: { departmentId: "dept", status: "APPROVED" },
    });
    await expect(
      transitionTask(actor, "task", 1, "SOURCE_FACT_CHECK", undefined),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    expect(prisma.prTask.updateMany).not.toHaveBeenCalled();
  });
  it.each([
    "PROPOSED",
    "UNDER_REVIEW",
    "PENDING_APPROVAL",
    "ACCEPTED",
    "REJECTED",
    "CONVERTED",
    "ARCHIVED",
  ])("cannot revise an own idea at %s", async (status) => {
    prisma.prContentIdea.findFirst.mockResolvedValue({ id: "idea", status, version: 1 });
    await expect(reviseIdea(actor, "idea", 1, {})).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("queries only the same organization, department and proposer when amending", async () => {
    prisma.prContentIdea.findFirst.mockResolvedValue(null);
    await expect(reviseIdea(actor, "other-idea", 1, {})).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(prisma.prContentIdea.findFirst).toHaveBeenCalledWith({
      where: {
        id: "other-idea",
        organizationId: "org",
        departmentId: "dept",
        proposerId: "requester",
      },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("requires an active department and matching idea version", async () => {
    await expect(
      reviseIdea({ ...actor, departmentId: null }, "idea", 1, {}),
    ).rejects.toMatchObject({ code: "SCOPE_REQUIRED" });
    prisma.prContentIdea.findFirst.mockResolvedValue({
      id: "idea",
      status: "REVISION_REQUIRED",
      version: 2,
    });
    await expect(reviseIdea(actor, "idea", 1, {})).rejects.toMatchObject({
      code: "STALE_UPDATE",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("lists only the actor's newest notifications", async () => {
    prisma.prNotification.findMany.mockResolvedValue([]);
    await listNotifications(actor);
    expect(prisma.prNotification.findMany).toHaveBeenCalledWith({
      where: { userId: "requester" },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  });
  it("cannot mark a different user's notification read", async () => {
    prisma.prNotification.updateMany.mockResolvedValue({ count: 0 });
    await markNotificationsRead(actor, ["other-users-notification"]);
    expect(prisma.prNotification.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["other-users-notification"] },
        userId: "requester",
        readAt: null,
      },
      data: { readAt: expect.any(Date) },
    });
  });
});
