import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    prMessageHouseVersion: {
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
    },
  },
}));

import { currentMessageHouse, messageHouseHistory } from "./service";

const actor = {
  id: "user-1",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "PR_OPERATIONS" as const,
};

describe("currentMessageHouse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue(null);
    mocks.findMany.mockResolvedValue([]);
  });

  it("returns only the latest approved effective version for the actor's organization", async () => {
    await currentMessageHouse(actor);

    expect(mocks.findFirst).toHaveBeenCalledOnce();
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        status: "APPROVED",
        effectiveAt: { lte: expect.any(Date) },
      },
      orderBy: [{ effectiveAt: "desc" }, { versionNumber: "desc" }],
      select: {
        versionNumber: true,
        vision: true,
        positioning: true,
        pillars: true,
        foundation: true,
        effectiveAt: true,
      },
    });
  });

  it("denies current-version reads to roles without Message House page access", async () => {
    await expect(currentMessageHouse({ ...actor, role: "REQUESTER" })).rejects.toThrow(
      "You cannot view Message House",
    );
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("lists only approved or superseded versions that are already effective", async () => {
    await messageHouseHistory(actor);

    expect(mocks.findMany).toHaveBeenCalledOnce();
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        status: { in: ["APPROVED", "SUPERSEDED"] },
        effectiveAt: { lte: expect.any(Date) },
      },
      orderBy: [{ effectiveAt: "desc" }, { versionNumber: "desc" }],
      select: {
        versionNumber: true,
        vision: true,
        positioning: true,
        pillars: true,
        foundation: true,
        effectiveAt: true,
      },
    });
  });

  it("denies history reads to roles without Message House page access", async () => {
    await expect(messageHouseHistory({ ...actor, role: "REQUESTER" })).rejects.toThrow(
      "You cannot view Message House",
    );
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
