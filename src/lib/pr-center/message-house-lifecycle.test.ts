import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    prMessageHouseVersion: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
    },
    prAuditEvent: { create: vi.fn() },
    prOutboxEvent: { create: vi.fn() },
  };
  return {
    tx,
    prisma: {
      $transaction: vi.fn((fn) => fn(tx)),
      prMessageHouseVersion: { findMany: vi.fn() },
    },
  };
});
vi.mock("@/lib/db/client", () => ({ prisma: mocks.prisma }));
import {
  transitionMessageHouse,
  messageHouseReview,
  saveMessageHouseDraft,
} from "./service";

const pr = {
  id: "owner",
  organizationId: "org",
  departmentId: "dept",
  role: "RTRDA_PR" as const,
  roleGrants: [{ role: "RTRDA_PR" as const, departmentId: null }],
};
const bord = {
  ...pr,
  id: "board",
  role: "RTRDA_BORD" as const,
  roleGrants: [{ role: "RTRDA_BORD" as const, departmentId: null }],
};
const draft = {
  id: "draft",
  organizationId: "org",
  ownerId: "owner",
  rowVersion: 1,
  versionNumber: 2,
  status: "DRAFT",
  effectiveAt: null,
};
const future = new Date(Date.now() + 86400000).toISOString();

describe("Message House lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation((fn) => fn(mocks.tx));
    mocks.tx.prMessageHouseVersion.findFirst.mockResolvedValue(draft);
    mocks.tx.prMessageHouseVersion.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.prMessageHouseVersion.findUniqueOrThrow.mockResolvedValue({
      ...draft,
      rowVersion: 2,
      status: "IN_REVIEW",
    });
    mocks.tx.prAuditEvent.create.mockResolvedValue({});
    mocks.tx.prOutboxEvent.create.mockResolvedValue({});
  });
  it("submits only the owner's in-scope draft by version and audits/outboxes", async () => {
    await transitionMessageHouse(pr, "draft", 1, { to: "IN_REVIEW" }, "corr");
    expect(mocks.tx.prMessageHouseVersion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org",
          ownerId: "owner",
          status: "DRAFT",
          rowVersion: 1,
        }),
      }),
    );
    expect(mocks.tx.prAuditEvent.create).toHaveBeenCalledOnce();
    expect(mocks.tx.prOutboxEvent.create).toHaveBeenCalledOnce();
  });
  it("denies department-only PR and unrelated global ADMIN grants", async () => {
    await expect(
      transitionMessageHouse(
        {
          ...pr,
          roleGrants: [
            { role: "RTRDA_PR", departmentId: "dept" },
            { role: "RTRDA_ADMIN", departmentId: null },
          ],
        },
        "draft",
        1,
        { to: "IN_REVIEW" },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
  it("denies self-approval even with BORD grant", async () => {
    mocks.tx.prMessageHouseVersion.findFirst.mockResolvedValue({
      ...draft,
      status: "IN_REVIEW",
    });
    await expect(
      transitionMessageHouse({ ...bord, id: "owner" }, "draft", 1, {
        to: "APPROVED",
        reason: "reviewed",
        effectiveAt: future,
      }),
    ).rejects.toMatchObject({ code: "SEPARATION_OF_DUTIES" });
    expect(mocks.tx.prMessageHouseVersion.updateMany).not.toHaveBeenCalled();
  });
  it("approves with future date, reason and conditional version", async () => {
    mocks.tx.prMessageHouseVersion.findFirst
      .mockResolvedValueOnce({ ...draft, status: "IN_REVIEW" })
      .mockResolvedValueOnce(null);
    mocks.tx.prMessageHouseVersion.findUniqueOrThrow.mockResolvedValue({
      ...draft,
      rowVersion: 2,
      status: "APPROVED",
      effectiveAt: new Date(future),
    });
    await transitionMessageHouse(bord, "draft", 1, {
      to: "APPROVED",
      reason: "  verified  ",
      effectiveAt: future,
    });
    expect(mocks.tx.prMessageHouseVersion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "IN_REVIEW",
          rowVersion: 1,
          ownerId: { not: "board" },
        }),
        data: expect.objectContaining({
          decisionReason: "verified",
          effectiveAt: new Date(future),
        }),
      }),
    );
  });
  it("rejects with a required reason and does not set an effective date", async () => {
    mocks.tx.prMessageHouseVersion.findFirst.mockResolvedValue({
      ...draft,
      status: "IN_REVIEW",
    });
    await expect(
      transitionMessageHouse(bord, "draft", 1, { to: "REJECTED" }),
    ).rejects.toMatchObject({ code: "REASON_REQUIRED" });
    await transitionMessageHouse(bord, "draft", 1, {
      to: "REJECTED",
      reason: "Not ready",
    });
    expect(mocks.tx.prMessageHouseVersion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REJECTED",
          effectiveAt: null,
          decisionReason: "Not ready",
        }),
      }),
    );
  });
  it("rejects stale or raced writes without audit", async () => {
    mocks.tx.prMessageHouseVersion.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      transitionMessageHouse(pr, "draft", 1, { to: "IN_REVIEW" }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect(mocks.tx.prAuditEvent.create).not.toHaveBeenCalled();
  });
  it("rejects invalid or earlier effective dates", async () => {
    mocks.tx.prMessageHouseVersion.findFirst
      .mockResolvedValueOnce({ ...draft, status: "IN_REVIEW" })
      .mockResolvedValueOnce({ effectiveAt: new Date(Date.now() + 172800000) });
    await expect(
      transitionMessageHouse(bord, "draft", 1, {
        to: "APPROVED",
        reason: "ok",
        effectiveAt: future,
      }),
    ).rejects.toMatchObject({ code: "EFFECTIVE_DATE_CONFLICT" });
    await expect(
      transitionMessageHouse(bord, "draft", 1, {
        to: "APPROVED",
        reason: "ok",
        effectiveAt: "yesterday",
      }),
    ).rejects.toMatchObject({ code: "INVALID_EFFECTIVE_DATE" });
  });
  it("limits the review queue to other owners in the same organization", async () => {
    mocks.prisma.prMessageHouseVersion.findMany.mockResolvedValue([]);
    await messageHouseReview(bord);
    expect(mocks.prisma.prMessageHouseVersion.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org", status: "IN_REVIEW", ownerId: { not: "board" } },
      orderBy: { versionNumber: "desc" },
    });
  });
  it("requires row version on edit and honors mixed role grants", async () => {
    await expect(saveMessageHouseDraft(pr, {}, "draft")).rejects.toMatchObject({
      code: "PRECONDITION_REQUIRED",
    });
    await expect(
      transitionMessageHouse(
        { ...bord, roleGrants: [{ role: "RTRDA_PR", departmentId: null }] },
        "draft",
        1,
        { to: "REJECTED", reason: "no" },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
