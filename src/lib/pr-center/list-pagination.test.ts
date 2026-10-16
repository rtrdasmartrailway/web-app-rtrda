import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    prRequest: { findMany: vi.fn(), findFirst: vi.fn() },
    prAuditEvent: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
import {
  listRequests,
  listAuditEvents,
  listAccessAuditEvents,
  type PrCenterActor,
} from "./service";

const actor: PrCenterActor = {
  id: "mine",
  organizationId: "org",
  departmentId: "dept",
  role: "RTRDA_ALL_USER",
};
const cursor = "00000000-0000-4000-8000-000000000001";
const date = new Date("2026-01-01T00:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.prRequest.findMany.mockResolvedValue([]);
  prismaMock.prAuditEvent.findMany.mockResolvedValue([]);
});

describe("request list filtering and pagination", () => {
  it.each([
    "title:asc",
    "requestedFor:desc",
    "department:asc",
    "requester:desc",
    "status:asc",
    "createdAt:asc",
  ])(
    "paginates %s using the selected order within scoped filtered rows",
    async (sort) => {
      prismaMock.prRequest.findFirst.mockResolvedValue({ id: cursor, createdAt: date });
      await listRequests(actor, 2, cursor, { sort, mine: true, status: "DRAFT" });
      const query = prismaMock.prRequest.findMany.mock.calls[0][0];
      expect(query).toMatchObject({ cursor: { id: cursor }, skip: 1, take: 3 });
      expect(query.where.AND).toContainEqual({ requesterId: actor.id });
      expect(query.where.AND).toContainEqual({ status: "DRAFT" });
      expect(query.where.AND).toContainEqual({
        organizationId: "org",
        OR: [{ requesterId: "mine" }],
      });
      expect(query.where.AND).not.toContainEqual({
        OR: [{ createdAt: { lt: date } }, { createdAt: date, id: { lt: cursor } }],
      });
      const [field, direction] = sort.split(":");
      const primary =
        field === "requestedFor"
          ? { requestedFor: { sort: direction, nulls: "last" } }
          : field === "department"
            ? { department: { name: direction } }
            : field === "requester"
              ? { requester: { displayName: direction } }
              : { [field]: direction };
      expect(query.orderBy).toEqual([primary, { id: direction }]);
    },
  );

  it("rejects unknown sort fields before querying data", async () => {
    await expect(
      listRequests(actor, 2, undefined, { sort: "organizationId:asc" }),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(prismaMock.prRequest.findMany).not.toHaveBeenCalled();
  });
  it("conjoins scoped access with title/number search, status and mine", async () => {
    await listRequests(actor, 2, undefined, {
      q: "Budget",
      status: "APPROVED",
      mine: true,
    });
    expect(prismaMock.prRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              organizationId: "org",
              OR: [{ requesterId: "mine" }, { tasks: { some: { ownerId: "mine" } } }],
            },
            { requesterId: "mine" },
            { status: "APPROVED" },
            { organizationId: "org", OR: [{ requesterId: "mine" }] },
            {
              OR: [
                { title: { contains: "Budget", mode: "insensitive" } },
                { requestNumber: { contains: "Budget", mode: "insensitive" } },
              ],
            },
          ],
        },
        take: 3,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
  });

  it("escapes LIKE metacharacters instead of treating them as a search wildcard", async () => {
    await listRequests(actor, 5, undefined, { q: "%_\\" });
    const query = prismaMock.prRequest.findMany.mock.calls[0][0].where.AND.at(-1);
    expect(query.OR[0].title.contains).toBe("\\%\\_\\\\");
  });

  it("restricts title search to fully readable requests, not assigned-only metadata", async () => {
    await listRequests(actor, 5, undefined, { q: "private" });
    expect(prismaMock.prRequest.findMany.mock.calls[0][0].where.AND).toContainEqual({
      organizationId: "org",
      OR: [{ requesterId: "mine" }],
    });
  });

  it("keeps the scope and filters on cursor lookup and uses timestamp/id keyset", async () => {
    prismaMock.prRequest.findFirst.mockResolvedValue({ id: cursor, createdAt: date });
    await listRequests(actor, 2, cursor, { status: "DRAFT" });
    expect(prismaMock.prRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              organizationId: "org",
              OR: [{ requesterId: "mine" }, { tasks: { some: { ownerId: "mine" } } }],
            },
            { status: "DRAFT" },
            { id: cursor },
          ],
        },
      }),
    );
    expect(prismaMock.prRequest.findMany.mock.calls[0][0].where.AND).toContainEqual({
      OR: [{ createdAt: { lt: date } }, { createdAt: date, id: { lt: cursor } }],
    });
  });

  it("rejects an out-of-scope cursor without listing records", async () => {
    prismaMock.prRequest.findFirst.mockResolvedValue(null);
    await expect(listRequests(actor, 2, cursor)).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(prismaMock.prRequest.findMany).not.toHaveBeenCalled();
  });

  it("returns a scoped lookahead row and redacts assigned-only records", async () => {
    prismaMock.prRequest.findMany.mockResolvedValue(
      Array.from({ length: 3 }, (_, i) => ({
        id: String(i),
        requesterId: "other",
        organizationId: "org",
        departmentId: "elsewhere",
        status: "DRAFT",
        tasks: [{ ownerId: "mine" }, { ownerId: "other" }],
      })),
    );
    const result = await listRequests(actor, 2);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      id: "0",
      status: "DRAFT",
      requesterId: "",
      tasks: [{ ownerId: "mine" }],
      sources: [],
      assignedTaskOnly: true,
    });
  });
});

describe("audit history pagination", () => {
  it("keeps the actor sort and own-event scope on subsequent pages", async () => {
    prismaMock.prAuditEvent.findFirst.mockResolvedValue({ id: cursor, createdAt: date });
    await listAuditEvents(actor, 2, cursor, { sort: "actor:asc" });
    expect(prismaMock.prAuditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { organizationId: "org", actorId: "mine" },
            { OR: [{ actor: { is: null }, id: { gt: cursor } }] },
          ],
        },
        orderBy: [{ actor: { displayName: "asc" } }, { id: "asc" }],
      }),
    );
  });

  it("advances from null actors into named actors when sorting descending", async () => {
    prismaMock.prAuditEvent.findFirst.mockResolvedValue({
      id: cursor,
      createdAt: date,
      actor: null,
    });
    await listAuditEvents(actor, 2, cursor, { sort: "actor:desc" });
    const query = prismaMock.prAuditEvent.findMany.mock.calls[0][0];
    expect(query.cursor).toBeUndefined();
    expect(query.where.AND[1]).toEqual({
      OR: [{ actor: { is: null }, id: { lt: cursor } }, { actor: { isNot: null } }],
    });
  });

  it("includes null actors after equal-name/id rows when sorting ascending", async () => {
    prismaMock.prAuditEvent.findFirst.mockResolvedValue({
      id: cursor,
      createdAt: date,
      actor: { displayName: "กานต์" },
    });
    await listAuditEvents(actor, 2, cursor, { sort: "actor:asc" });
    expect(prismaMock.prAuditEvent.findMany.mock.calls[0][0].where.AND[1]).toEqual({
      OR: [
        { actor: { is: { displayName: { gt: "กานต์" } } } },
        { actor: { is: { displayName: "กานต์" } }, id: { gt: cursor } },
        { actor: { is: null } },
      ],
    });
  });

  it("sorts access events before taking an offset page and retains access filters", async () => {
    await listAccessAuditEvents(
      { ...actor, role: "RTRDA_ADMIN" },
      201,
      "action:asc",
      200,
    );
    const query = prismaMock.prAuditEvent.findMany.mock.calls[0][0];
    expect(query).toMatchObject({
      take: 201,
      skip: 200,
      orderBy: [{ action: "asc" }, { id: "asc" }],
    });
    expect(query.where.organizationId).toBe("org");
    expect(query.where.action.in).toContain("auth.oidc_login");
  });
  it("limits department-scoped grants to own events and applies search", async () => {
    await listAuditEvents(
      {
        ...actor,
        role: "RTRDA_PR",
        roleGrants: [{ role: "RTRDA_PR", departmentId: "dept" }],
      },
      2,
      undefined,
      { q: "request" },
    );
    expect(prismaMock.prAuditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { organizationId: "org", actorId: "mine" },
            {
              OR: [
                { action: { contains: "request", mode: "insensitive" } },
                { entityType: { contains: "request", mode: "insensitive" } },
                { entityId: { contains: "request", mode: "insensitive" } },
              ],
            },
          ],
        },
        take: 3,
      }),
    );
  });
  it("allows organization-wide eligible grants but not unrelated grants", async () => {
    await listAuditEvents({
      ...actor,
      roleGrants: [
        { role: "RTRDA_ALL_USER", departmentId: null },
        { role: "RTRDA_BORD", departmentId: null },
      ],
    });
    expect(prismaMock.prAuditEvent.findMany.mock.calls[0][0].where).toEqual({
      organizationId: "org",
    });
  });
  it("rejects a cursor outside filtered history", async () => {
    prismaMock.prAuditEvent.findFirst.mockResolvedValue(null);
    await expect(listAuditEvents(actor, 10, cursor)).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(prismaMock.prAuditEvent.findMany).not.toHaveBeenCalled();
  });
  it("uses stable keyset and returns lookahead", async () => {
    prismaMock.prAuditEvent.findFirst.mockResolvedValue({ id: cursor, createdAt: date });
    prismaMock.prAuditEvent.findMany.mockResolvedValue([
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ]);
    expect(await listAuditEvents(actor, 2, cursor)).toEqual([
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ]);
    expect(prismaMock.prAuditEvent.findMany.mock.calls[0][0].where.AND).toContainEqual({
      OR: [{ createdAt: { lt: date } }, { createdAt: date, id: { lt: cursor } }],
    });
  });
});
