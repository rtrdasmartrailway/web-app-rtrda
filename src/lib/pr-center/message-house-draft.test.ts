import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    prMessageHouseVersion: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    prAuditEvent: { create: vi.fn() },
    prOutboxEvent: { create: vi.fn() },
  };
  return {
    tx,
    prisma: {
      $transaction: vi.fn((callback) => callback(tx)),
    },
  };
});

vi.mock("@/lib/db/client", () => ({ prisma: mocks.prisma }));

import { saveMessageHouseDraft } from "./service";

const actor = {
  id: "pr-lead",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "PR_OPERATIONS" as const,
};

const input = {
  vision: "Vision",
  positioning: "Positioning",
  pillars: ["Safety", "Research"],
  foundation: "Evidence",
  sourceRationale: "Approved strategy source",
};

describe("Message House draft editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.tx));
    mocks.tx.prMessageHouseVersion.findFirst.mockResolvedValue(null);
    mocks.tx.prMessageHouseVersion.create.mockResolvedValue({
      id: "draft-1",
      versionNumber: 5,
      status: "DRAFT",
      ...input,
    });
    mocks.tx.prAuditEvent.create.mockResolvedValue({ id: "audit-1" });
    mocks.tx.prOutboxEvent.create.mockResolvedValue({ id: "outbox-1" });
  });

  it("creates a versioned draft and audits the save", async () => {
    await saveMessageHouseDraft(actor, input, undefined, "corr-1");

    expect(mocks.tx.prMessageHouseVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        versionNumber: 1,
        status: "DRAFT",
        ownerId: "pr-lead",
        pillars: ["Safety", "Research"],
      }),
    });
    expect(mocks.tx.prAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "message_house.draft_saved" }),
      }),
    );
  });

  it("updates only the actor's existing draft", async () => {
    mocks.tx.prMessageHouseVersion.findFirst.mockResolvedValue({
      id: "draft-1",
      versionNumber: 5,
      status: "DRAFT",
    });
    mocks.tx.prMessageHouseVersion.update.mockResolvedValue({
      id: "draft-1",
      versionNumber: 5,
      status: "DRAFT",
      ...input,
    });

    await saveMessageHouseDraft(actor, input, "draft-1", "corr-2");

    expect(mocks.tx.prMessageHouseVersion.update).toHaveBeenCalledWith({
      where: { id: "draft-1" },
      data: expect.objectContaining({
        vision: "Vision",
        pillars: ["Safety", "Research"],
      }),
    });
  });

  it("rejects incomplete drafts before writing", async () => {
    await expect(
      saveMessageHouseDraft(actor, { ...input, pillars: [] }),
    ).rejects.toMatchObject({ code: "INVALID_MESSAGE_HOUSE", statusCode: 422 });
    expect(mocks.tx.prMessageHouseVersion.create).not.toHaveBeenCalled();
  });

  it("denies non-PR editors", async () => {
    await expect(
      saveMessageHouseDraft({ ...actor, role: "REQUESTER" }, input),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
});
