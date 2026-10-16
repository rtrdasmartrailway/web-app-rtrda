import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prMessageHouseVersion: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  prAuditEvent: { create: vi.fn() },
  prOutboxEvent: { create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/db/client", () => ({ prisma: db }));
import {
  currentMessageHouse,
  messageHouseHistory,
  messageHouseDraft,
  saveMessageHouseDraft,
  transitionMessageHouse,
  type PrCenterActor,
} from "./service";

const actor: PrCenterActor = {
  id: "owner",
  organizationId: "org",
  departmentId: "home",
  role: "RTRDA_ADMIN",
  roleGrants: [{ role: "RTRDA_PR", departmentId: "dept" }],
};
const input = {
  vision: "Vision",
  positioning: "Position",
  foundation: "Evidence",
  pillars: ["Safety"],
};
const draft = {
  id: "draft",
  organizationId: "org",
  ownerId: "owner",
  status: "DRAFT",
  rowVersion: 1,
  versionNumber: 1,
};

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((callback) => callback(db));
  db.prMessageHouseVersion.findFirst.mockResolvedValue(null);
  db.prMessageHouseVersion.findMany.mockResolvedValue([]);
  db.prMessageHouseVersion.create.mockResolvedValue(draft);
  db.prMessageHouseVersion.updateMany.mockResolvedValue({ count: 1 });
  db.prMessageHouseVersion.findUniqueOrThrow.mockResolvedValue({
    ...draft,
    status: "IN_REVIEW",
    rowVersion: 2,
  });
  db.prAuditEvent.create.mockResolvedValue({});
  db.prOutboxEvent.create.mockResolvedValue({});
});

describe("PR operations Message House grant isolation", () => {
  it.each(["RTRDA_ALL_USER", "RTRDA_PR", "RTRDA_BORD", "RTRDA_ADMIN"] as const)(
    "allows scoped %s to read current/history, regardless of selected display role",
    async (role) => {
      const reader = { ...actor, roleGrants: [{ role, departmentId: "dept" }] };
      await currentMessageHouse(reader);
      await messageHouseHistory(reader);
      expect(db.prMessageHouseVersion.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org",
            status: "APPROVED",
            effectiveAt: { lte: expect.any(Date) },
          }),
        }),
      );
      expect(db.prMessageHouseVersion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: "org",
            status: { in: ["APPROVED", "SUPERSEDED"] },
            effectiveAt: { lte: expect.any(Date) },
          },
        }),
      );
    },
  );

  it.each(["RTRDA_ALL_USER", "RTRDA_BORD", "RTRDA_ADMIN"] as const)(
    "does not widen department PR authoring through an unrelated global %s grant",
    async (role) => {
      const scoped = {
        ...actor,
        roleGrants: [...actor.roleGrants!, { role, departmentId: null }],
      };
      await expect(messageHouseDraft(scoped)).rejects.toMatchObject({ statusCode: 403 });
      await expect(saveMessageHouseDraft(scoped, input)).rejects.toMatchObject({
        statusCode: 403,
      });
      await expect(
        transitionMessageHouse(scoped, "draft", 1, { to: "IN_REVIEW" }),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(db.prMessageHouseVersion.findFirst).not.toHaveBeenCalled();
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );

  it("uses organization-wide PR authority despite an unrelated selected display role/home department", async () => {
    const globalPr: PrCenterActor = {
      ...actor,
      roleGrants: [
        { role: "RTRDA_ALL_USER", departmentId: "home" },
        { role: "RTRDA_PR", departmentId: null },
      ],
    };
    await messageHouseDraft(globalPr);
    expect(db.prMessageHouseVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org",
          ownerId: "owner",
          status: { in: ["DRAFT", "IN_REVIEW", "REJECTED"] },
        },
      }),
    );
    await expect(saveMessageHouseDraft(globalPr, input)).resolves.toEqual(draft);
    db.prMessageHouseVersion.findFirst.mockResolvedValue(draft);
    await expect(
      transitionMessageHouse(globalPr, "draft", 1, { to: "IN_REVIEW" }),
    ).resolves.toMatchObject({ status: "IN_REVIEW" });
    expect(db.prMessageHouseVersion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "draft",
          organizationId: "org",
          rowVersion: 1,
          status: "DRAFT",
          ownerId: "owner",
        },
      }),
    );
  });
});
