import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: { prUserDraft: mocks },
}));

import { deleteUserDraft, getUserDraft, saveUserDraft } from "./service";

const requester = {
  id: "requester-1",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "RTRDA_ALL_USER" as const,
};

describe("server-side autosaved drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue(null);
    mocks.upsert.mockResolvedValue({ updatedAt: new Date("2026-10-08T00:00:00Z") });
    mocks.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("loads the authenticated requester's draft only", async () => {
    await getUserDraft(requester, "REQUEST");
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { userId_kind: { userId: "requester-1", kind: "REQUEST" } },
      select: { payload: true, updatedAt: true },
    });
  });

  it("stores supported request fields and excludes uploaded File objects", async () => {
    await saveUserDraft(requester, "REQUEST", {
      title: "Rail project",
      objective: "Explain project progress",
      contentTypes: ["Website News"],
      samples: ["must-not-be-stored"],
    });
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { userId_kind: { userId: "requester-1", kind: "REQUEST" } },
      create: {
        organizationId: "org-1",
        userId: "requester-1",
        kind: "REQUEST",
        payload: {
          title: "Rail project",
          objective: "Explain project progress",
          contentTypes: ["Website News"],
        },
      },
      update: {
        organizationId: "org-1",
        payload: {
          title: "Rail project",
          objective: "Explain project progress",
          contentTypes: ["Website News"],
        },
      },
      select: { updatedAt: true },
    });
  });

  it("allows an author to remove their draft", async () => {
    await deleteUserDraft(requester, "IDEA");
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { userId: "requester-1", organizationId: "org-1", kind: "IDEA" },
    });
  });

  it("allows RTRDA_BORD to save an idea draft", async () => {
    await expect(
      saveUserDraft({ ...requester, role: "RTRDA_BORD" }, "IDEA", { title: "Idea" }),
    ).resolves.toMatchObject({ updatedAt: new Date("2026-10-08T00:00:00.000Z") });
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_kind: { userId: "requester-1", kind: "IDEA" } },
        create: expect.objectContaining({ kind: "IDEA", payload: { title: "Idea" } }),
      }),
    );
  });
});
