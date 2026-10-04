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

const messageHouseVersions = [
  {
    versionNumber: 4,
    vision: "Approved vision, version 4",
    positioning: "Approved positioning, version 4",
    pillars: ["Safety", "Research"],
    foundation: "Evidence and service",
    effectiveAt: new Date("2026-09-01T00:00:00.000Z"),
  },
  {
    versionNumber: 3,
    vision: "Approved vision, version 3",
    positioning: "Approved positioning, version 3",
    pillars: ["Safety"],
    foundation: "Evidence",
    effectiveAt: new Date("2026-06-01T00:00:00.000Z"),
  },
];

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

  it("returns the complete current version with its effective date", async () => {
    mocks.findFirst.mockResolvedValue(messageHouseVersions[0]);

    await expect(currentMessageHouse(actor)).resolves.toEqual(messageHouseVersions[0]);
  });

  it("allows scoped administrators to read the current organization version", async () => {
    mocks.findFirst.mockResolvedValue(messageHouseVersions[0]);

    await expect(
      currentMessageHouse({ ...actor, role: "SCOPED_ADMINISTRATOR" }),
    ).resolves.toEqual(messageHouseVersions[0]);
  });

  it.each(["REQUESTER", "APPROVER", "EXECUTIVE_READ_ONLY"] as const)(
    "denies current-version reads to %s",
    async (role) => {
      await expect(currentMessageHouse({ ...actor, role })).rejects.toThrow(
        "You cannot view Message House",
      );
      expect(mocks.findFirst).not.toHaveBeenCalled();
    },
  );

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

  it("returns every approved effective version with its original content and date", async () => {
    mocks.findMany.mockResolvedValue(messageHouseVersions);

    await expect(messageHouseHistory(actor)).resolves.toEqual(messageHouseVersions);
  });

  it("denies history reads to roles without Message House page access", async () => {
    await expect(messageHouseHistory({ ...actor, role: "REQUESTER" })).rejects.toThrow(
      "You cannot view Message House",
    );
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
