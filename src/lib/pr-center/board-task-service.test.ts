import { beforeEach, describe, expect, it, vi } from "vitest";
const { db } = vi.hoisted(() => ({
  db: {
    prTask: { findFirst: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    prSchedule: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    prStatusHistory: { create: vi.fn() },
    prAuditEvent: { create: vi.fn() },
    prOutboxEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/db/client", () => ({ prisma: db }));
import { moveBoardTask, type PrCenterActor } from "./service";
import { BOARD_COLUMNS } from "./board-moves";
const actor: PrCenterActor = {
  id: "pr",
  organizationId: "org",
  departmentId: "dept",
  role: "RTRDA_PR",
  roleGrants: [{ role: "RTRDA_PR", departmentId: "dept" }],
};
const task = (status = "DRAFT", requestStatus = "APPROVED") => ({
  id: "task",
  version: 4,
  status,
  request: { status: requestStatus },
  revisions: [],
});
const schedule = {
  column: "Scheduled" as const,
  channel: "Website",
  scheduledFor: new Date("2099-12-01T00:00:00Z"),
  idempotencyKey: "board-schedule-test",
};
beforeEach(() => {
  vi.clearAllMocks();
  db.prTask.findFirst.mockResolvedValue(task());
  db.prTask.updateMany.mockResolvedValue({ count: 1 });
  db.prTask.findUniqueOrThrow.mockResolvedValue({
    ...task(),
    status: "IN_PRODUCTION",
    version: 5,
  });
  db.prSchedule.findUnique.mockResolvedValue(null);
  db.prSchedule.findFirst.mockResolvedValue(null);
  db.prSchedule.findMany.mockResolvedValue([]);
  db.prSchedule.deleteMany.mockResolvedValue({ count: 0 });
  db.$transaction.mockImplementation((fn) => fn(db));
});
describe("PR unrestricted board positioning", () => {
  it.each([
    "DRAFT",
    "COMMUNICATION_PLANNING",
    "SOURCE_FACT_CHECK",
    "SCHEDULED",
    "PUBLISHED",
    "CLOSED",
  ])("moves %s directly into production without approval commands", async (status) => {
    db.prTask.findFirst.mockResolvedValue(task(status));
    await moveBoardTask(actor, "task", 4, { column: "In production" }, "correlation");
    expect(db.prTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task", version: 4, status, request: { status: "APPROVED" } },
        data: { status: "IN_PRODUCTION", channel: null, version: { increment: 1 } },
      }),
    );
    expect(db.prStatusHistory.create).toHaveBeenCalledWith({
      data: {
        taskId: "task",
        actorId: "pr",
        fromState: status,
        toState: "IN_PRODUCTION",
        reason: "PR board move: In production",
      },
    });
    expect(db.prAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: "pr",
          action: "task.board_moved",
          correlationId: "correlation",
          after: expect.objectContaining({
            from: status,
            to: "IN_PRODUCTION",
            contentApprovalRequired: false,
          }),
        }),
      }),
    );
  });
  it.each(BOARD_COLUMNS.filter((column) => column !== "Scheduled"))(
    "allows review work to move directly to %s",
    async (column) => {
      db.prTask.findFirst.mockResolvedValue(task("PR_EDITORIAL_REVIEW"));
      await moveBoardTask(actor, "task", 4, { column });
      expect(db.prTask.updateMany).toHaveBeenCalledOnce();
    },
  );
  it("schedules draft work without revisions, assets, owner or content approval and records the real source state", async () => {
    await moveBoardTask(actor, "task", 4, schedule);
    expect(db.prSchedule.create).toHaveBeenCalledWith({
      data: {
        taskId: "task",
        channel: "Website",
        scheduledFor: schedule.scheduledFor,
        taskRevision: 1,
        idempotencyKey: schedule.idempotencyKey,
      },
    });
    expect(db.prTask.updateMany.mock.calls[0][0].data.status).toBe("SCHEDULED");
    expect(db.prStatusHistory.create.mock.calls[0][0].data).toMatchObject({
      fromState: "DRAFT",
      toState: "SCHEDULED",
    });
  });
  it("keeps published evidence while cancelling old pending reminders on a reverse move", async () => {
    db.prTask.findFirst.mockResolvedValue(task("SCHEDULED"));
    db.prSchedule.findMany.mockResolvedValue([
      { id: "old", channel: "Website", scheduledFor: schedule.scheduledFor },
    ]);
    await moveBoardTask(actor, "task", 4, { column: "Planning" });
    expect(db.prSchedule.deleteMany).toHaveBeenCalledWith({
      where: { taskId: "task", publishedAt: null },
    });
    expect(
      db.prAuditEvent.create.mock.calls[0][0].data.after.previousSchedules,
    ).toHaveLength(1);
  });
  it.each(["RTRDA_ALL_USER", "RTRDA_BORD", "RTRDA_ADMIN"] as const)(
    "rejects %s without an explicit PR grant",
    async (role) => {
      await expect(
        moveBoardTask(
          { ...actor, role, roleGrants: [{ role, departmentId: null }] },
          "task",
          4,
          schedule,
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(db.prTask.findFirst).not.toHaveBeenCalled();
    },
  );
  it("uses PR scope even when an additional admin grant is organization-wide", async () => {
    db.prTask.findFirst.mockResolvedValue(null);
    await expect(
      moveBoardTask(
        {
          ...actor,
          roleGrants: [...actor.roleGrants!, { role: "RTRDA_ADMIN", departmentId: null }],
        },
        "other",
        4,
        { column: "Planning" },
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(db.prTask.findFirst.mock.calls[0][0].where.request).toEqual({
      organizationId: "org",
      OR: [{ departmentId: "dept" }],
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it.each(["DRAFT", "SUBMITTED", "REJECTED", "WITHDRAWN", "CANCELLED"])(
    "retains request approval eligibility for %s",
    async (requestStatus) => {
      db.prTask.findFirst.mockResolvedValue(task("DRAFT", requestStatus));
      await expect(moveBoardTask(actor, "task", 4, schedule)).rejects.toMatchObject({
        statusCode: 422,
      });
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );
  it("rejects unsupported columns and stale updates before writing", async () => {
    await expect(
      moveBoardTask(actor, "task", 4, { column: "Bogus" as never }),
    ).rejects.toMatchObject({ statusCode: 422 });
    await expect(
      moveBoardTask(actor, "task", 2, { column: "Review" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("fails atomic concurrent updates without recording history or cancelling schedules", async () => {
    db.prTask.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      moveBoardTask(actor, "task", 4, { column: "Review" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.prStatusHistory.create).not.toHaveBeenCalled();
    expect(db.prSchedule.deleteMany).not.toHaveBeenCalled();
  });
  it.each([
    { ...schedule, channel: "" },
    { ...schedule, scheduledFor: new Date(0) },
    { ...schedule, scheduledFor: new Date("bad") },
    { ...schedule, idempotencyKey: "" },
  ])("validates schedule input before writes", async (input) => {
    await expect(moveBoardTask(actor, "task", 4, input)).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("returns a matching schedule retry without duplicate writes", async () => {
    db.prTask.findFirst.mockResolvedValue(task("SCHEDULED"));
    db.prSchedule.findUnique.mockResolvedValue({
      taskId: "task",
      channel: "Website",
      scheduledFor: schedule.scheduledFor,
      taskRevision: 1,
    });
    await expect(moveBoardTask(actor, "task", 3, schedule)).resolves.toMatchObject({
      taskVersion: 4,
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
