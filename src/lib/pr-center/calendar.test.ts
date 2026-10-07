import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  scheduleFindMany: vi.fn(),
  taskFindMany: vi.fn(),
  statusHistoryFindMany: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    prSchedule: { findMany: mocks.scheduleFindMany },
    prTask: { findMany: mocks.taskFindMany },
    prStatusHistory: { findMany: mocks.statusHistoryFindMany },
    prCenterUser: { findMany: mocks.userFindMany },
  },
}));

import { listCalendarEntries, listCalendarRequestDecisions } from "./service";

const actor = {
  id: "user-1",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "PR_OPERATIONS" as const,
};
const from = new Date("2026-10-01T00:00:00.000Z");
const to = new Date("2026-11-01T00:00:00.000Z");

describe("listCalendarEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.scheduleFindMany.mockResolvedValue([]);
    mocks.taskFindMany.mockResolvedValue([]);
    mocks.statusHistoryFindMany.mockResolvedValue([]);
    mocks.userFindMany.mockResolvedValue([]);
  });

  it("returns scoped schedules, publications, and draft due dates as distinct read-only entries", async () => {
    const scheduledFor = new Date("2026-10-10T09:00:00.000Z");
    const publishedAt = new Date("2026-10-11T10:00:00.000Z");
    const draftDueAt = new Date("2026-10-12T11:00:00.000Z");
    mocks.scheduleFindMany.mockResolvedValue([
      {
        id: "schedule-1",
        taskId: "task-1",
        channel: "Website",
        taskRevision: 2,
        scheduledFor,
        publishedAt: null,
        publishedUrl: null,
        publishedReference: null,
        task: { title: "Scheduled story", request: { requestNumber: "PR-2026-001" } },
      },
      {
        id: "schedule-2",
        taskId: "task-2",
        channel: "Facebook",
        taskRevision: 1,
        scheduledFor,
        publishedAt,
        publishedUrl: "https://example.org/news",
        publishedReference: "facebook-123",
        task: { title: "Published story", request: { requestNumber: "PR-2026-002" } },
      },
    ]);
    mocks.taskFindMany.mockResolvedValue([
      {
        id: "task-3",
        title: "Draft story",
        contentType: "Website News",
        dueAt: draftDueAt,
        request: { requestNumber: "PR-2026-003" },
      },
    ]);

    const result = await listCalendarEntries(actor, from, to);

    expect(result.map((entry) => entry.status)).toEqual([
      "SCHEDULED",
      "PUBLISHED",
      "DRAFT",
    ]);
    expect(result.map((entry) => entry.date)).toEqual([
      scheduledFor,
      publishedAt,
      draftDueAt,
    ]);
    expect(result[1]).toMatchObject({
      taskId: "task-2",
      channel: "Facebook",
      status: "PUBLISHED",
      publishedUrl: "https://example.org/news",
      publishedReference: "facebook-123",
    });
    expect(result[2]).toMatchObject({
      taskId: "task-3",
      requestNumber: "PR-2026-003",
      channel: null,
      status: "DRAFT",
    });
    expect(mocks.scheduleFindMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { scheduledFor: { gte: from, lt: to }, publishedAt: null },
          { publishedAt: { gte: from, lt: to } },
        ],
        task: { request: { organizationId: "org-1", OR: [{ departmentId: "dept-1" }] } },
      },
      select: {
        id: true,
        taskId: true,
        channel: true,
        taskRevision: true,
        scheduledFor: true,
        publishedAt: true,
        publishedUrl: true,
        publishedReference: true,
        task: {
          select: {
            title: true,
            request: { select: { requestNumber: true } },
          },
        },
      },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
    });
    expect(mocks.taskFindMany).toHaveBeenCalledWith({
      where: {
        status: "DRAFT",
        dueAt: { gte: from, lt: to },
        request: { organizationId: "org-1", OR: [{ departmentId: "dept-1" }] },
      },
      select: {
        id: true,
        title: true,
        contentType: true,
        dueAt: true,
        request: { select: { requestNumber: true } },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
    });
  });

  it("scopes requester calendar data to their own requests", async () => {
    const requester = { ...actor, id: "requester-1", role: "REQUESTER" as const };
    await listCalendarEntries(requester, from, to);

    expect(mocks.scheduleFindMany.mock.calls[0][0].where.task.request).toEqual({
      organizationId: "org-1",
      OR: [{ requesterId: "requester-1" }],
    });
    expect(mocks.taskFindMany.mock.calls[0][0].where.request).toEqual({
      organizationId: "org-1",
      OR: [{ requesterId: "requester-1" }],
    });
  });

  it.each([
    [new Date("invalid"), to],
    [to, from],
    [from, new Date("2027-01-01T00:00:00.000Z")],
  ])(
    "rejects an invalid, reversed, or excessively large range",
    async (rangeFrom, rangeTo) => {
      await expect(listCalendarEntries(actor, rangeFrom, rangeTo)).rejects.toMatchObject({
        statusCode: 422,
        code: "INVALID_CALENDAR_RANGE",
      });
      expect(mocks.scheduleFindMany).not.toHaveBeenCalled();
      expect(mocks.taskFindMany).not.toHaveBeenCalled();
    },
  );
});

describe("listCalendarRequestDecisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.statusHistoryFindMany.mockResolvedValue([]);
    mocks.userFindMany.mockResolvedValue([]);
  });

  it("returns only scoped approvals and rejections with actor and request details", async () => {
    mocks.statusHistoryFindMany.mockResolvedValue([
      {
        id: "history-1",
        requestId: "request-1",
        toState: "REJECTED",
        reason: "Missing source",
        actorId: "approver-1",
        createdAt: new Date("2026-10-12T03:15:00.000Z"),
        request: { requestNumber: "PR-2026-001", title: "Station opening" },
      },
      {
        id: "history-2",
        requestId: "request-2",
        toState: "APPROVED",
        reason: null,
        actorId: "approver-2",
        createdAt: new Date("2026-10-12T04:15:00.000Z"),
        request: { requestNumber: "PR-2026-002", title: "Rail exhibition" },
      },
    ]);
    mocks.userFindMany.mockResolvedValue([
      { id: "approver-1", displayName: "Reviewer One" },
      { id: "approver-2", displayName: "Reviewer Two" },
    ]);

    const result = await listCalendarRequestDecisions(actor, from, to);

    expect(result).toMatchObject([
      { decision: "REJECTED", reason: "Missing source", actorName: "Reviewer One" },
      { decision: "APPROVED", reason: null, actorName: "Reviewer Two" },
    ]);
    expect(mocks.statusHistoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          requestId: { not: null },
          toState: { in: ["APPROVED", "REJECTED"] },
          createdAt: { gte: from, lt: to },
          request: { is: { organizationId: "org-1", OR: [{ departmentId: "dept-1" }] } },
        }),
      }),
    );
  });

  it("rejects invalid date ranges", async () => {
    await expect(listCalendarRequestDecisions(actor, to, from)).rejects.toMatchObject({
      code: "INVALID_CALENDAR_RANGE",
    });
    expect(mocks.statusHistoryFindMany).not.toHaveBeenCalled();
  });
});
