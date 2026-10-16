import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prMessageHouseVersion: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  prCenterUser: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  prDepartment: { findFirst: vi.fn() },
  prUserRole: {
    findFirst: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  prOrganizationSetting: { upsert: vi.fn() },
  prAuditEvent: { create: vi.fn(), findMany: vi.fn() },
  prOutboxEvent: { create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/db/client", () => ({ prisma: db }));
import {
  currentMessageHouse,
  messageHouseHistory,
  messageHouseReview,
  messageHouseDraft,
  saveMessageHouseDraft,
  transitionMessageHouse,
  listAdminUsers,
  grantRole,
  revokeRole,
  toggleUserActive,
  listAccessAuditEvents,
  exportAuditEvents,
  savePrMasterData,
  type PrCenterActor,
  type PrCenterRoleGrant,
} from "./service";
import { directoryUserAuthority } from "./directory-access";

type Row = Record<string, unknown>;
// Deliberately evaluate real query predicates and select projections: returning
// whole fixtures would hide an unscoped query or manufacture a DTO leak.
function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "AND" || key === "OR") {
      const terms = (Array.isArray(condition) ? condition : [condition]) as Row[];
      return key === "AND"
        ? terms.every((term) => matches(row, term))
        : terms
            .filter((term) => Object.keys(term).length > 0)
            .some((term) => matches(row, term));
    }
    if (condition && typeof condition === "object" && !(condition instanceof Date)) {
      const operators = condition as Row;
      if ("in" in operators) return (operators.in as unknown[]).includes(row[key]);
      if ("not" in operators) return row[key] !== null && row[key] !== operators.not;
      if ("lte" in operators)
        return row[key] instanceof Date && row[key] <= (operators.lte as Date);
      return !!row[key] && matches(row[key] as Row, operators);
    }
    return row[key] === condition;
  });
}
function project(row: Row, select: Row): Row {
  return Object.fromEntries(
    Object.entries(select).map(([key, selection]) => {
      if (selection === true) return [key, row[key]];
      const relation = selection as { where?: Row; select: Row };
      const value = row[key];
      return [
        key,
        Array.isArray(value)
          ? value
              .filter((item) => !relation.where || matches(item, relation.where))
              .map((item) => project(item, relation.select))
          : value
            ? project(value as Row, relation.select)
            : null,
      ];
    }),
  );
}
function actor(...roleGrants: PrCenterRoleGrant[]): PrCenterActor {
  return {
    id: "board",
    organizationId: "org",
    departmentId: "home",
    // A deliberately unrelated display role must confer no extra authority.
    role: "RTRDA_ADMIN",
    roleGrants,
  };
}
const board = (departmentId: string | null = "dept-1") =>
  actor({ role: "RTRDA_BORD", departmentId });
const input = {
  vision: "Vision",
  positioning: "Position",
  foundation: "Evidence",
  pillars: ["Safety"],
};
const master = { channels: ["Web"], contentTypes: ["News"], contentPillars: ["Safety"] };
const draft = {
  id: "mh",
  organizationId: "org",
  ownerId: "author",
  status: "IN_REVIEW",
  rowVersion: 1,
  versionNumber: 2,
  effectiveAt: null,
};
const target = () => ({
  id: "target",
  organizationId: "org",
  departmentId: "dept-1",
  active: true,
  email: "fixture@example.invalid",
  roles: [],
});

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((callback) => callback(db));
  db.prMessageHouseVersion.findFirst.mockResolvedValue(draft);
  db.prMessageHouseVersion.findMany.mockResolvedValue([]);
  db.prMessageHouseVersion.create.mockResolvedValue({
    ...draft,
    ownerId: "board",
    status: "DRAFT",
  });
  db.prMessageHouseVersion.updateMany.mockResolvedValue({ count: 1 });
  db.prMessageHouseVersion.findUniqueOrThrow.mockResolvedValue({
    ...draft,
    rowVersion: 2,
    status: "REJECTED",
  });
  db.prCenterUser.findFirst.mockResolvedValue(target());
  db.prCenterUser.findMany.mockResolvedValue([]);
  db.prCenterUser.updateMany.mockResolvedValue({ count: 1 });
  db.prDepartment.findFirst.mockResolvedValue({ id: "dept-1" });
  db.prUserRole.findFirst.mockResolvedValue(null);
  db.prUserRole.create.mockResolvedValue({ id: "grant" });
  db.prUserRole.deleteMany.mockResolvedValue({ count: 1 });
  db.prUserRole.count.mockResolvedValue(1);
  db.prOrganizationSetting.upsert.mockResolvedValue({ id: "settings" });
  db.prAuditEvent.findMany.mockResolvedValue([]);
  db.prAuditEvent.create.mockResolvedValue({});
  db.prOutboxEvent.create.mockResolvedValue({});
});

describe("BORD Message House grant boundaries", () => {
  it.each([null, "dept-1"])(
    "reads only effective public fields with BORD scope %s",
    async (scope) => {
      const publicVersion = {
        ...draft,
        ...input,
        status: "APPROVED",
        effectiveAt: new Date("2020-01-01T00:00:00Z"),
        sourceRationale: "internal rationale",
        decisionReason: "internal review",
        approverId: "private-approver",
      };
      const rows = [
        publicVersion,
        { ...publicVersion, id: "foreign", organizationId: "other" },
        { ...publicVersion, id: "pending", status: "IN_REVIEW" },
        { ...publicVersion, id: "future", effectiveAt: new Date("2999-01-01T00:00:00Z") },
      ];
      db.prMessageHouseVersion.findFirst.mockImplementation(({ where, select }) => {
        const found = rows.find((row) => matches(row, where));
        return Promise.resolve(found ? project(found, select) : null);
      });
      db.prMessageHouseVersion.findMany.mockImplementation(({ where, select }) =>
        Promise.resolve(
          rows.filter((row) => matches(row, where)).map((row) => project(row, select)),
        ),
      );
      const current = await currentMessageHouse(board(scope));
      const history = await messageHouseHistory(board(scope));
      const allowed = [
        "effectiveAt",
        "foundation",
        "pillars",
        "positioning",
        "versionNumber",
        "vision",
      ];
      expect(Object.keys(current!).sort()).toEqual(allowed);
      expect(history).toHaveLength(1);
      expect(Object.keys(history[0]).sort()).toEqual([...allowed, "status"].sort());
      expect(current?.vision).toBe("Vision");
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );

  it.each(["APPROVED", "REJECTED"] as const)(
    "organization BORD can decide %s with guarded writes",
    async (to) => {
      const effectiveAt = new Date(Date.now() + 86_400_000).toISOString();
      db.prMessageHouseVersion.findFirst
        .mockResolvedValueOnce(draft)
        .mockResolvedValueOnce(null);
      await transitionMessageHouse(board(null), "mh", 1, {
        to,
        reason: "Independent decision",
        ...(to === "APPROVED" ? { effectiveAt } : {}),
      });
      expect(db.prMessageHouseVersion.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "mh",
            organizationId: "org",
            rowVersion: 1,
            status: "IN_REVIEW",
            ownerId: { not: "board" },
          },
          data: expect.objectContaining({ status: to, reviewerId: "board" }),
        }),
      );
      expect(db.prAuditEvent.create).toHaveBeenCalledOnce();
      expect(db.prOutboxEvent.create).toHaveBeenCalledOnce();
    },
  );

  it.each(["RTRDA_ALL_USER", "RTRDA_PR", "RTRDA_ADMIN"] as const)(
    "global %s cannot broaden department BORD review or decisions",
    async (role) => {
      const scoped = actor(
        { role: "RTRDA_BORD", departmentId: "dept-1" },
        { role, departmentId: null },
      );
      await expect(messageHouseReview(scoped)).rejects.toMatchObject({ statusCode: 403 });
      for (const to of ["APPROVED", "REJECTED"] as const)
        await expect(
          transitionMessageHouse(scoped, "mh", 1, { to, reason: "decision" }),
        ).rejects.toMatchObject({ statusCode: 403 });
      expect(db.prMessageHouseVersion.findMany).not.toHaveBeenCalled();
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );

  it.each([null, "dept-1"])(
    "BORD scope %s alone cannot author, edit or submit",
    async (scope) => {
      await expect(messageHouseDraft(board(scope))).rejects.toMatchObject({
        statusCode: 403,
      });
      await expect(saveMessageHouseDraft(board(scope), input)).rejects.toMatchObject({
        statusCode: 403,
      });
      await expect(
        saveMessageHouseDraft(board(scope), input, "mh", "corr", 1),
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(
        transitionMessageHouse(board(scope), "mh", 1, { to: "IN_REVIEW" }),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(db.prMessageHouseVersion.findFirst).not.toHaveBeenCalled();
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );

  it("global BORD cannot broaden department PR authoring", async () => {
    const mixed = actor(
      { role: "RTRDA_BORD", departmentId: null },
      { role: "RTRDA_PR", departmentId: "dept-1" },
    );
    await expect(messageHouseDraft(mixed)).rejects.toMatchObject({ statusCode: 403 });
    await expect(saveMessageHouseDraft(mixed, input)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(
      transitionMessageHouse(mixed, "mh", 1, { to: "IN_REVIEW" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("independent global PR permits authoring but retains owner-only submission", async () => {
    const mixed = actor(
      { role: "RTRDA_BORD", departmentId: "dept-1" },
      { role: "RTRDA_PR", departmentId: null },
    );
    await expect(saveMessageHouseDraft(mixed, input)).resolves.toMatchObject({
      status: "DRAFT",
    });
    db.prMessageHouseVersion.findFirst.mockResolvedValue({ ...draft, status: "DRAFT" });
    await expect(
      transitionMessageHouse(mixed, "mh", 1, { to: "IN_REVIEW" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(db.prMessageHouseVersion.updateMany).not.toHaveBeenCalled();
    db.prMessageHouseVersion.findFirst.mockResolvedValue({
      ...draft,
      ownerId: "board",
      status: "DRAFT",
    });
    await expect(
      transitionMessageHouse(mixed, "mh", 1, { to: "IN_REVIEW" }),
    ).resolves.toBeDefined();
  });

  it("global BORD review excludes own drafts; mixed PR/BORD cannot self-decide", async () => {
    const mixed = actor(
      { role: "RTRDA_BORD", departmentId: null },
      { role: "RTRDA_PR", departmentId: null },
    );
    await messageHouseReview(mixed);
    expect(db.prMessageHouseVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org", status: "IN_REVIEW", ownerId: { not: "board" } },
      }),
    );
    db.prMessageHouseVersion.findFirst.mockResolvedValue({ ...draft, ownerId: "board" });
    await expect(
      transitionMessageHouse(mixed, "mh", 1, { to: "REJECTED", reason: "decision" }),
    ).rejects.toMatchObject({ code: "SEPARATION_OF_DUTIES" });
    expect(db.prMessageHouseVersion.updateMany).not.toHaveBeenCalled();
  });

  it("lost decision write returns conflict without audit/outbox or readback", async () => {
    db.prMessageHouseVersion.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      transitionMessageHouse(board(null), "mh", 1, {
        to: "REJECTED",
        reason: "decision",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.prAuditEvent.create).not.toHaveBeenCalled();
    expect(db.prOutboxEvent.create).not.toHaveBeenCalled();
    expect(db.prMessageHouseVersion.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe("BORD directory and independent admin boundaries", () => {
  it.each([null, "dept-1"])(
    "returns active scoped safe directory rows with BORD scope %s",
    async (scope) => {
      const grants = [
        {
          id: "board-one",
          role: "RTRDA_BORD",
          departmentId: "dept-1",
          organizationId: "org",
        },
        {
          id: "board-two",
          role: "RTRDA_BORD",
          departmentId: "dept-2",
          organizationId: "org",
        },
        { id: "admin", role: "RTRDA_ADMIN", departmentId: null, organizationId: "org" },
        {
          id: "foreign",
          role: "RTRDA_BORD",
          departmentId: null,
          organizationId: "other",
        },
      ];
      const rows = ["dept-1", "dept-2"].flatMap((departmentId) =>
        [true, false].map((active) => ({
          ...target(),
          id: `${departmentId}-${active}`,
          departmentId,
          active,
          displayName: "Fixture",
          department: {
            id: departmentId,
            name: "Department",
            internalMetadata: "secret",
          },
          ssoSubject: "private",
          createdAt: new Date(),
          updatedAt: new Date(),
          roles: grants,
        })),
      );
      rows.push({ ...rows[0], id: "foreign", organizationId: "other" });
      db.prCenterUser.findMany.mockImplementation(({ where, select }) =>
        Promise.resolve(
          rows.filter((row) => matches(row, where)).map((row) => project(row, select)),
        ),
      );
      const reader = actor(
        { role: "RTRDA_BORD", departmentId: scope },
        { role: "RTRDA_ALL_USER", departmentId: null },
      );
      const result = await listAdminUsers(reader);
      expect(result.map((row) => row.id)).toEqual(
        scope === null ? ["dept-1-true", "dept-2-true"] : ["dept-1-true"],
      );
      for (const row of result) {
        expect(Object.keys(row).sort()).toEqual([
          "active",
          "department",
          "departmentId",
          "displayName",
          "email",
          "id",
          "roles",
          "rolesRestricted",
        ]);
        expect(row.rolesRestricted).toBe(true);
        expect(Object.keys(row.department!).sort()).toEqual(["id", "name"]);
        expect(row.roles.map((grant) => grant.id)).toEqual(
          scope === null ? ["board-one", "board-two"] : ["board-one"],
        );
        expect(directoryUserAuthority(reader, row)).toEqual({
          administer: false,
          grantBoard: false,
          canGrant: false,
        });
      }
    },
  );

  it("unions BORD and PR active scopes but exposes inactive rows only in independent admin scope", async () => {
    const mixed = actor(
      { role: "RTRDA_BORD", departmentId: "dept-1" },
      { role: "RTRDA_PR", departmentId: "dept-2" },
      { role: "RTRDA_ADMIN", departmentId: "dept-3" },
      { role: "RTRDA_ALL_USER", departmentId: null },
    );
    await listAdminUsers(mixed);
    const { where } = db.prCenterUser.findMany.mock.calls[0][0];
    for (const departmentId of ["dept-1", "dept-2", "dept-3", "dept-4"])
      for (const active of [true, false])
        expect(matches({ organizationId: "org", departmentId, active }, where)).toBe(
          departmentId === "dept-3" ||
            (active && ["dept-1", "dept-2"].includes(departmentId)),
        );
    expect(
      matches({ organizationId: "other", departmentId: "dept-3", active: true }, where),
    ).toBe(false);
  });

  it.each([null, "dept-1"])(
    "BORD scope %s cannot mutate access, read audit, export or edit masters",
    async (scope) => {
      await expect(
        grantRole(board(scope), "target", "RTRDA_BORD", "dept-1", "appointment"),
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(revokeRole(board(scope), "grant", "removal")).rejects.toMatchObject({
        statusCode: 403,
      });
      await expect(
        toggleUserActive(board(scope), "target", "deactivate"),
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(listAccessAuditEvents(board(scope))).rejects.toMatchObject({
        statusCode: 403,
      });
      await expect(exportAuditEvents(board(scope), {})).rejects.toMatchObject({
        statusCode: 403,
      });
      await expect(savePrMasterData(board(scope), master)).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(db.prCenterUser.findFirst).not.toHaveBeenCalled();
      expect(db.prUserRole.findFirst).not.toHaveBeenCalled();
      expect(db.prAuditEvent.findMany).not.toHaveBeenCalled();
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );

  it("global BORD does not broaden a department PR grant power", async () => {
    const mixed = actor(
      { role: "RTRDA_BORD", departmentId: null },
      { role: "RTRDA_PR", departmentId: "dept-2" },
    );
    await expect(
      grantRole(mixed, "target", "RTRDA_BORD", "dept-1", "appointment"),
    ).rejects.toMatchObject({ statusCode: 403 });
    db.prCenterUser.findFirst.mockResolvedValue({ ...target(), departmentId: "dept-2" });
    await expect(
      grantRole(mixed, "target", "RTRDA_BORD", "dept-2", "appointment"),
    ).resolves.toEqual({ id: "grant" });
    await expect(
      grantRole(mixed, "target", "RTRDA_PR", "dept-2", "appointment"),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(revokeRole(mixed, "grant", "removal")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("global BORD does not broaden independent department admin mutation or global operations", async () => {
    const mixed = actor(
      { role: "RTRDA_BORD", departmentId: null },
      { role: "RTRDA_ADMIN", departmentId: "dept-2" },
    );
    await expect(
      grantRole(mixed, "target", "RTRDA_PR", "dept-1", "assignment"),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(toggleUserActive(mixed, "target", "deactivate")).rejects.toMatchObject({
      statusCode: 403,
    });
    db.prUserRole.findFirst.mockResolvedValue({
      id: "grant",
      role: "RTRDA_PR",
      departmentId: "dept-1",
      user: target(),
    });
    await expect(revokeRole(mixed, "grant", "removal")).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(exportAuditEvents(mixed, {})).rejects.toMatchObject({ statusCode: 403 });
    await expect(savePrMasterData(mixed, master)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(db.$transaction).not.toHaveBeenCalled();
    await listAccessAuditEvents(mixed);
    expect(db.prAuditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: "org", actorId: "board" }),
      }),
    );
  });

  it("independent department admin can grant, revoke and deactivate inside its own scope", async () => {
    const mixed = actor(
      { role: "RTRDA_BORD", departmentId: "dept-2" },
      { role: "RTRDA_ADMIN", departmentId: "dept-1" },
    );
    await expect(
      grantRole(mixed, "target", "RTRDA_PR", "dept-1", "assignment"),
    ).resolves.toEqual({ id: "grant" });
    db.prUserRole.findFirst.mockResolvedValue({
      id: "grant",
      userId: "target",
      organizationId: "org",
      role: "RTRDA_PR",
      departmentId: "dept-1",
      user: target(),
    });
    await expect(revokeRole(mixed, "grant", "removal")).resolves.toEqual({
      id: "grant",
      removed: true,
    });
    await expect(toggleUserActive(mixed, "target", "deactivate")).resolves.toEqual({
      id: "target",
      active: false,
    });
    expect(db.prUserRole.create).toHaveBeenCalledOnce();
    expect(db.prUserRole.deleteMany).toHaveBeenCalledOnce();
    expect(db.prCenterUser.updateMany).toHaveBeenCalledOnce();
    expect(db.prAuditEvent.create).toHaveBeenCalledTimes(3);
  });

  it("independent global admin permits export and master edit without BORD implying either", async () => {
    const mixed = actor(
      { role: "RTRDA_BORD", departmentId: "dept-1" },
      { role: "RTRDA_ADMIN", departmentId: null },
    );
    await expect(exportAuditEvents(mixed, {}, "corr")).resolves.toMatchObject({
      count: 0,
    });
    await expect(savePrMasterData(mixed, master)).resolves.toEqual(master);
    expect(db.prAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "audit.exported",
          organizationId: "org",
        }),
      }),
    );
  });
});

describe("regressions: independent scoped access writes revalidate at mutation time", () => {
  // Each interleaving is a committed change AFTER the initial authorization read
  // but BEFORE the transaction starts. Serializable alone cannot protect a read
  // performed outside that transaction. No real database is used.
  it.each(["moved", "deactivated"])(
    "PR grant fails closed when target is %s before transaction",
    async (change) => {
      const mixed = actor(
        { role: "RTRDA_BORD", departmentId: null },
        { role: "RTRDA_PR", departmentId: "dept-1" },
      );
      let current = target();
      db.prCenterUser.findFirst.mockImplementation(({ where }) =>
        Promise.resolve(matches(current, where) ? structuredClone(current) : null),
      );
      db.$transaction.mockImplementation(async (callback) => {
        current =
          change === "moved"
            ? { ...current, departmentId: "dept-2" }
            : { ...current, active: false };
        return callback(db);
      });
      await expect(
        grantRole(mixed, "target", "RTRDA_BORD", "dept-1", "appointment"),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(db.prUserRole.create).not.toHaveBeenCalled();
      expect(db.prAuditEvent.create).not.toHaveBeenCalled();
    },
  );

  it("scoped admin cannot deactivate a user moved outside admin scope before transaction", async () => {
    const mixed = actor(
      { role: "RTRDA_BORD", departmentId: null },
      { role: "RTRDA_ADMIN", departmentId: "dept-1" },
    );
    let current = target();
    db.prCenterUser.findFirst.mockImplementation(({ where }) =>
      Promise.resolve(matches(current, where) ? structuredClone(current) : null),
    );
    db.prCenterUser.updateMany.mockImplementation(({ where, data }) => {
      if (!matches(current, where)) throw new Error("Conditional write rejected");
      current = { ...current, ...data };
      return Promise.resolve({ count: 1 });
    });
    db.$transaction.mockImplementation(async (callback) => {
      current = { ...current, departmentId: "dept-2" };
      return callback(db);
    });
    await expect(toggleUserActive(mixed, "target", "deactivate")).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(db.prCenterUser.updateMany).not.toHaveBeenCalled();
    expect(db.prAuditEvent.create).not.toHaveBeenCalled();
  });

  it("scoped admin cannot revoke assignment moved outside admin scope before transaction", async () => {
    const mixed = actor(
      { role: "RTRDA_BORD", departmentId: null },
      { role: "RTRDA_ADMIN", departmentId: "dept-1" },
    );
    let current = {
      id: "grant",
      userId: "target",
      organizationId: "org",
      role: "RTRDA_PR",
      departmentId: "dept-1",
      user: target(),
    };
    db.prUserRole.findFirst.mockImplementation(({ where }) =>
      Promise.resolve(matches(current, where) ? structuredClone(current) : null),
    );
    db.prUserRole.deleteMany.mockImplementation(({ where }) => {
      if (!matches(current, where)) throw new Error("Conditional delete rejected");
      return Promise.resolve({ count: 1 });
    });
    db.$transaction.mockImplementation(async (callback) => {
      current = { ...current, departmentId: "dept-2" };
      return callback(db);
    });
    await expect(revokeRole(mixed, "grant", "removal")).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(db.prUserRole.deleteMany).not.toHaveBeenCalled();
    expect(db.prAuditEvent.create).not.toHaveBeenCalled();
  });
});

describe("access mutation conditional-write evidence", () => {
  const administrator = () => actor({ role: "RTRDA_ADMIN", departmentId: "dept-1" });
  it("rejects a user moved after transaction authorization and emits no audit", async () => {
    const before = target();
    db.prCenterUser.findFirst.mockResolvedValue(before);
    db.prCenterUser.updateMany.mockImplementation(({ where }) =>
      Promise.resolve({
        count: matches({ ...before, departmentId: "dept-2" }, where) ? 1 : 0,
      }),
    );
    await expect(
      toggleUserActive(administrator(), "target", "change"),
    ).rejects.toMatchObject({ code: "STALE_ACCESS_ADMIN_WRITE", statusCode: 409 });
    expect(db.prCenterUser.updateMany).toHaveBeenCalledWith({
      where: {
        id: "target",
        organizationId: "org",
        departmentId: "dept-1",
        active: true,
      },
      data: { active: false },
    });
    expect(db.prAuditEvent.create).not.toHaveBeenCalled();
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });
  it("rejects a grant moved after transaction authorization and emits no audit", async () => {
    const before = {
      id: "grant",
      userId: "target",
      organizationId: "org",
      role: "RTRDA_PR",
      departmentId: "dept-1",
      user: target(),
    };
    db.prUserRole.findFirst.mockResolvedValue(before);
    db.prUserRole.deleteMany.mockImplementation(({ where }) =>
      Promise.resolve({
        count: matches({ ...before, departmentId: "dept-2" }, where) ? 1 : 0,
      }),
    );
    await expect(revokeRole(administrator(), "grant", "change")).rejects.toMatchObject({
      code: "STALE_ACCESS_ADMIN_WRITE",
      statusCode: 409,
    });
    expect(db.prUserRole.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "grant",
        organizationId: "org",
        role: "RTRDA_PR",
        departmentId: "dept-1",
        userId: "target",
        user: { organizationId: "org", departmentId: "dept-1" },
      },
    });
    expect(db.prAuditEvent.create).not.toHaveBeenCalled();
  });
  it("protects a newly promoted administrator when rechecking active-status authority", async () => {
    db.$transaction.mockImplementation((callback) => {
      db.prCenterUser.findFirst.mockResolvedValue({
        ...target(),
        roles: [{ role: "RTRDA_ADMIN", departmentId: "dept-1" }],
      });
      return callback(db);
    });
    await expect(
      toggleUserActive(administrator(), "target", "change"),
    ).rejects.toMatchObject({ code: "ROOT_ADMIN_REQUIRED" });
    expect(db.prCenterUser.updateMany).not.toHaveBeenCalled();
    expect(db.prAuditEvent.create).not.toHaveBeenCalled();
  });
  it("runs role grant in Serializable and maps a write conflict without auditing", async () => {
    db.$transaction.mockRejectedValue({ code: "P2034" });
    await expect(
      grantRole(administrator(), "target", "RTRDA_PR", "dept-1", "appointment"),
    ).rejects.toMatchObject({ code: "STALE_ACCESS_ADMIN_WRITE", statusCode: 409 });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(db.prUserRole.create).not.toHaveBeenCalled();
    expect(db.prAuditEvent.create).not.toHaveBeenCalled();
  });
});
