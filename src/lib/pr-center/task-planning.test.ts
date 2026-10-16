import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, tx } = vi.hoisted(() => {
  const tx = {
    prTask: { updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    prAuditEvent: { create: vi.fn() },
    prOutboxEvent: { create: vi.fn() },
    prNotification: { create: vi.fn() },
  };
  const prisma = {
    ...tx,
    prTask: { ...tx.prTask, findFirst: vi.fn() },
    prCenterUser: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((callback) => callback(tx));
  return { prisma, tx };
});

vi.mock("@/lib/db/client", () => ({ prisma }));

import { updateTaskAssignment, type PrCenterActor } from "./service";

const prActor: PrCenterActor = {
  id: "pr-1",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "RTRDA_PR",
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation((callback) => callback(tx));
  prisma.prTask.findFirst.mockResolvedValue({
    id: "task-1",
    ownerId: null,
    dueAt: null,
    version: 3,
    status: "COMMUNICATION_PLANNING",
    request: { status: "APPROVED" },
  });
  tx.prTask.updateMany.mockResolvedValue({ count: 1 });
  tx.prTask.findUniqueOrThrow.mockResolvedValue({
    id: "task-1",
    ownerId: null,
    owner: null,
    dueAt: new Date("2026-10-30T00:00:00.000Z"),
    planningKeyMessage: "Safe, reliable, connected travel",
    version: 4,
  });
  tx.prAuditEvent.create.mockResolvedValue({});
  tx.prOutboxEvent.create.mockResolvedValue({});
});

describe("task communication planning", () => {
  it("persists the planning key message with assignment and due date", async () => {
    const dueAt = new Date("2026-10-30T00:00:00.000Z");
    const result = await updateTaskAssignment(
      prActor,
      "task-1",
      3,
      {
        ownerId: null,
        dueAt,
        planningKeyMessage: "  Safe, reliable, connected travel  ",
      },
      "planning-correlation",
    );

    expect(tx.prTask.updateMany).toHaveBeenCalledWith({
      where: {
        id: "task-1",
        version: 3,
        status: "COMMUNICATION_PLANNING",
        request: { organizationId: "org-1", OR: [{ departmentId: "dept-1" }] },
      },
      data: {
        ownerId: null,
        dueAt,
        planningKeyMessage: "Safe, reliable, connected travel",
        version: { increment: 1 },
      },
    });
    expect(tx.prAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "task.assigned",
          correlationId: "planning-correlation",
          after: expect.objectContaining({
            planningKeyMessage: "Safe, reliable, connected travel",
          }),
        }),
      }),
    );
    expect(result.planningKeyMessage).toBe("Safe, reliable, connected travel");
  });

  it("only allows planning key-message edits in communication planning", async () => {
    prisma.prTask.findFirst.mockResolvedValueOnce({
      id: "task-1",
      ownerId: null,
      dueAt: null,
      version: 3,
      status: "IN_PRODUCTION",
      request: { status: "APPROVED" },
    });

    await expect(
      updateTaskAssignment(prActor, "task-1", 3, {
        ownerId: null,
        dueAt: null,
        planningKeyMessage: "New plan",
      }),
    ).rejects.toMatchObject({ code: "INVALID_PLANNING_STATE", statusCode: 409 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects planning key messages over the server-side limit", async () => {
    await expect(
      updateTaskAssignment(prActor, "task-1", 3, {
        ownerId: null,
        dueAt: null,
        planningKeyMessage: "x".repeat(2001),
      }),
    ).rejects.toMatchObject({ code: "INVALID_KEY_MESSAGE", statusCode: 422 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
