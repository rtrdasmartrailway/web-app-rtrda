import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/db/client", () => ({
  prisma: { prContentIdea: { findMany: mocks.findMany } },
}));

import { listIdeas } from "./service";

const actor = {
  id: "user-1",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "PR_OPERATIONS" as const,
};
const idea = (id: string) => ({
  id,
  title: `Idea ${id}`,
  rationale: "Rationale",
  proposerId: "user-1",
  audience: null,
  pillar: null,
  channel: null,
  priority: null,
  campaign: null,
  evidenceUrls: [],
  status: "PROPOSED",
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  convertedRequestId: null,
  version: 1,
});

describe("listIdeas pagination and scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
  });

  it("returns a stable page and next offset using the actor's department scope", async () => {
    const rows = [idea("idea-1"), idea("idea-2"), idea("idea-3")];
    mocks.findMany.mockResolvedValue(rows);

    const result = await listIdeas(actor, {
      take: 2,
      offset: 10,
      search: " launch ",
      status: "PROPOSED",
    });

    expect(result).toEqual({ items: rows.slice(0, 2), nextOffset: 12 });
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        departmentId: "dept-1",
        status: "PROPOSED",
        OR: [
          { title: { contains: "launch", mode: "insensitive" } },
          { rationale: { contains: "launch", mode: "insensitive" } },
          { audience: { contains: "launch", mode: "insensitive" } },
          { pillar: { contains: "launch", mode: "insensitive" } },
          { channel: { contains: "launch", mode: "insensitive" } },
          { priority: { contains: "launch", mode: "insensitive" } },
          { campaign: { contains: "launch", mode: "insensitive" } },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: 10,
      take: 3,
      select: {
        id: true,
        title: true,
        rationale: true,
        proposerId: true,
        audience: true,
        pillar: true,
        channel: true,
        priority: true,
        campaign: true,
        evidenceUrls: true,
        status: true,
        createdAt: true,
        convertedRequestId: true,
        version: true,
      },
    });
  });

  it("limits requester results to their own records", async () => {
    await listIdeas({ ...actor, role: "REQUESTER" }, { take: 50, offset: 0 });

    expect(mocks.findMany.mock.calls[0][0].where).toEqual({
      organizationId: "org-1",
      proposerId: "user-1",
    });
  });

  it.each([
    [{ take: 0, offset: 0 }],
    [{ take: 101, offset: 0 }],
    [{ take: 50, offset: -1 }],
    [{ take: 50, offset: 100001 }],
    [{ take: 50, offset: 0, search: "x".repeat(101) }],
    [{ take: 50, offset: 0, status: "UNKNOWN" }],
  ])("rejects invalid pagination before reading", async (pagination) => {
    await expect(listIdeas(actor, pagination)).rejects.toMatchObject({
      statusCode: 422,
      code: "INVALID_IDEA_LIST_QUERY",
    });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
