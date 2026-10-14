import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({
  db: {
    prRequest: { findMany: vi.fn(), findFirst: vi.fn() },
    prAuditEvent: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/db/client", () => ({ prisma: db }));
import { buildPrCenterApi } from "./app";

const actor = {
  id: "user",
  organizationId: "org",
  departmentId: "dept",
  role: "RTRDA_ALL_USER" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  db.prRequest.findMany.mockResolvedValue([]);
  db.prAuditEvent.findMany.mockResolvedValue([]);
});

describe("list route validation", () => {
  it.each(["/requests", "/audit"])(
    "rejects unauthenticated %s before query parsing",
    async (url) => {
      const app = buildPrCenterApi(async () => null);
      expect(
        (await app.inject({ method: "GET", url: `${url}?take=oops` })).statusCode,
      ).toBe(401);
      await app.close();
    },
  );

  it.each([
    "/requests?take=0",
    "/requests?take=101",
    "/requests?take=Infinity",
    "/requests?status=UNKNOWN",
    "/requests?mine=foo",
    "/requests?cursor=not-a-uuid",
    "/requests?q=x&q=y",
    `/requests?q=${"x".repeat(121)}`,
    "/audit?take=-1",
    "/audit?cursor=not-a-uuid",
    "/audit?mine=true",
  ])("rejects malformed list query %s without DB access", async (url) => {
    const app = buildPrCenterApi(async () => actor);
    const response = await app.inject({ method: "GET", url });
    expect(response.statusCode).toBe(422);
    expect(db.prRequest.findMany).not.toHaveBeenCalled();
    expect(db.prAuditEvent.findMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("passes validated request filters into the scoped database query", async () => {
    const app = buildPrCenterApi(async () => actor);
    const response = await app.inject({
      method: "GET",
      url: "/requests?mine=true&status=DRAFT&q=launch&take=5",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
    expect(db.prRequest.findMany.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        take: 6,
        where: {
          AND: [
            {
              organizationId: "org",
              OR: [{ requesterId: "user" }, { tasks: { some: { ownerId: "user" } } }],
            },
            { requesterId: "user" },
            { status: "DRAFT" },
            { organizationId: "org", OR: [{ requesterId: "user" }] },
            {
              OR: [
                { title: { contains: "launch", mode: "insensitive" } },
                { requestNumber: { contains: "launch", mode: "insensitive" } },
              ],
            },
          ],
        },
      }),
    );
    await app.close();
  });

  it("returns the next audit page using a scoped cursor", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    db.prAuditEvent.findFirst.mockResolvedValue({
      id,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    db.prAuditEvent.findMany.mockResolvedValue([{ id: "next" }]);
    const app = buildPrCenterApi(async () => actor);
    const response = await app.inject({
      method: "GET",
      url: `/audit?take=1&cursor=${id}&q=request`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([{ id: "next" }]);
    expect(db.prAuditEvent.findFirst.mock.calls[0][0].where.AND[0]).toEqual({
      organizationId: "org",
      actorId: "user",
    });
    await app.close();
  });
});
