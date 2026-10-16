import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prCenterUser: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  prDepartment: { findFirst: vi.fn() },
  prUserRole: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
  prAuditEvent: { create: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/db/client", () => ({ prisma: db }));

import {
  grantRole,
  listAccessAuditEvents,
  listAdminUsers,
  revokeRole,
  toggleUserActive,
  type PrCenterActor,
} from "./service";

const pr: PrCenterActor = {
  id: "operator",
  organizationId: "org",
  departmentId: "home",
  role: "RTRDA_ALL_USER",
  roleGrants: [
    { role: "RTRDA_ALL_USER", departmentId: null },
    { role: "RTRDA_PR", departmentId: "dept-2" },
  ],
};
const mixed: PrCenterActor = {
  ...pr,
  roleGrants: [...pr.roleGrants!, { role: "RTRDA_ADMIN", departmentId: "dept-1" }],
};

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((callback) => callback(db));
  db.prCenterUser.findMany.mockResolvedValue([]);
  db.prCenterUser.findFirst.mockResolvedValue({
    id: "target",
    organizationId: "org",
    departmentId: "dept-2",
    active: true,
  });
  db.prDepartment.findFirst.mockResolvedValue({ id: "dept-2" });
  db.prUserRole.findFirst.mockResolvedValue(null);
  db.prUserRole.create.mockResolvedValue({ id: "new-grant" });
  db.prAuditEvent.create.mockResolvedValue({ id: "audit" });
});

// Evaluate only Prisma's scalar/AND/OR subset needed for directory scope. This
// checks the meaning of the predicate without prescribing its SQL/query shape.
function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "OR" || key === "AND") {
      const results = (condition as Record<string, unknown>[]).map((clause) =>
        matches(row, clause),
      );
      return key === "OR" ? results.some(Boolean) : results.every(Boolean);
    }
    if (condition && typeof condition === "object" && "in" in condition)
      return (condition.in as unknown[]).includes(row[key]);
    return row[key] === condition;
  });
}

describe("PR operations directory and grants", () => {
  it("uses the PR grant rather than home department, display role or unrelated global grant", async () => {
    await listAdminUsers(pr);
    expect(db.prCenterUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org",
          OR: [
            { departmentId: { in: [] } },
            { departmentId: { in: ["dept-2"] }, active: true },
          ],
        },
        select: expect.objectContaining({
          roles: expect.objectContaining({
            where: expect.objectContaining({ organizationId: "org" }),
          }),
        }),
      }),
    );
  });

  it("unions admin and PR directory scopes without exposing inactive users in PR-only scope", async () => {
    await listAdminUsers(mixed);
    const where = db.prCenterUser.findMany.mock.calls[0][0].where;
    const visible = (departmentId: string, active: boolean, organizationId = "org") =>
      matches({ departmentId, active, organizationId }, where);
    expect(visible("dept-1", true)).toBe(true);
    expect(visible("dept-1", false)).toBe(true);
    expect(visible("dept-2", true)).toBe(true);
    expect(visible("dept-2", false)).toBe(false);
    expect(visible("dept-3", true)).toBe(false);
    expect(visible("dept-1", true, "other-org")).toBe(false);
  });

  it("retains the PR BORD-grant power outside an independently held admin scope", async () => {
    await expect(
      grantRole(mixed, "target", "RTRDA_BORD", "dept-2", "Board appointment"),
    ).resolves.toEqual({ id: "new-grant" });
    expect(db.prUserRole.create).toHaveBeenCalledWith({
      data: {
        userId: "target",
        organizationId: "org",
        role: "RTRDA_BORD",
        departmentId: "dept-2",
      },
    });
  });

  it("trims and persists the mandatory PR grant reason with all current grants", async () => {
    await grantRole(
      pr,
      "target",
      "RTRDA_BORD",
      "dept-2",
      "  Board appointment  ",
      "corr",
    );
    expect(db.prAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "access.role_granted",
          correlationId: "corr",
          after: expect.objectContaining({
            reason: "Board appointment",
            authorityRoles: pr.roleGrants,
          }),
        }),
      }),
    );
  });

  it.each([undefined, null, "", "   ", "x".repeat(1001)])(
    "rejects invalid PR grant reason %# before database access",
    async (reason) => {
      await expect(
        grantRole(pr, "target", "RTRDA_BORD", "dept-2", reason),
      ).rejects.toMatchObject({ statusCode: 422 });
      expect(db.prCenterUser.findFirst).not.toHaveBeenCalled();
      expect(db.prUserRole.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    { departmentId: "dept-2", active: false },
    { departmentId: "dept-1", active: true },
    { departmentId: null, active: true },
  ])("denies inactive or department-mismatched targets: %j", async (target) => {
    db.prCenterUser.findFirst.mockResolvedValue({ id: "target", ...target });
    await expect(
      grantRole(pr, "target", "RTRDA_BORD", "dept-2", "appointment"),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.prUserRole.create).not.toHaveBeenCalled();
  });

  it.each(["RTRDA_ADMIN", "RTRDA_PR", "RTRDA_ALL_USER"] as const)(
    "denies PR granting %s",
    async (role) => {
      await expect(
        grantRole(pr, "target", role, "dept-2", "appointment"),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(db.prCenterUser.findFirst).not.toHaveBeenCalled();
      expect(db.prUserRole.create).not.toHaveBeenCalled();
    },
  );

  it("denies PR revocation, deactivation and access-audit reads before database access", async () => {
    await expect(revokeRole(pr, "grant", undefined)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(toggleUserActive(pr, "target", undefined)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(listAccessAuditEvents(pr)).rejects.toMatchObject({ statusCode: 403 });
    expect(db.prUserRole.findFirst).not.toHaveBeenCalled();
    expect(db.prCenterUser.findFirst).not.toHaveBeenCalled();
    expect(db.prAuditEvent.findMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("projects safe scalars and filters nested roles by each row's authority", async () => {
    const grants = [
      {
        id: "admin-one",
        role: "RTRDA_ADMIN",
        departmentId: "dept-1",
        organizationId: "org",
      },
      {
        id: "board-two",
        role: "RTRDA_BORD",
        departmentId: "dept-2",
        organizationId: "org",
      },
      {
        id: "admin-global",
        role: "RTRDA_ADMIN",
        departmentId: null,
        organizationId: "org",
      },
      {
        id: "board-other",
        role: "RTRDA_BORD",
        departmentId: "dept-3",
        organizationId: "org",
      },
    ];
    const users = ["dept-1", "dept-2", "dept-3"].map((departmentId) => ({
      id: departmentId,
      departmentId,
      organizationId: "org",
      active: true,
      displayName: "Directory fixture",
      email: "fixture@example.invalid",
      ssoSubject: "private-sso-identity",
      createdAt: new Date(),
      updatedAt: new Date(),
      roles: grants,
      department: { id: departmentId, name: "Fixture department" },
    }));
    db.prCenterUser.findMany.mockImplementation(({ where, select }) =>
      Promise.resolve(
        users
          .filter((user) => matches(user, where))
          .map((user) =>
            Object.fromEntries(
              Object.entries(select).map(([key, value]) => [
                key,
                key === "roles"
                  ? grants
                      .filter((grant) =>
                        matches(
                          grant,
                          (value as { where: Record<string, unknown> }).where,
                        ),
                      )
                      .map(({ id, role, departmentId }) => ({ id, role, departmentId }))
                  : user[key as keyof typeof user],
              ]),
            ),
          ),
      ),
    );
    const result = await listAdminUsers(mixed);
    expect(result.map((user) => user.id)).toEqual(["dept-1", "dept-2"]);
    expect(result[0].roles.map((role) => role.id)).toEqual(["admin-one", "admin-global"]);
    expect(result[1].roles.map((role) => role.id)).toEqual(["board-two"]);
    for (const user of result) {
      expect(user).not.toHaveProperty("ssoSubject");
      expect(user).not.toHaveProperty("createdAt");
      expect(user).not.toHaveProperty("updatedAt");
    }
  });

  it("unions simultaneous PR and BORD directory grants", async () => {
    await listAdminUsers({
      ...pr,
      roleGrants: [...pr.roleGrants!, { role: "RTRDA_BORD", departmentId: "dept-3" }],
    });
    const { where } = db.prCenterUser.findMany.mock.calls[0][0];
    expect(
      matches({ organizationId: "org", departmentId: "dept-2", active: true }, where),
    ).toBe(true);
    expect(
      matches({ organizationId: "org", departmentId: "dept-3", active: true }, where),
    ).toBe(true);
    expect(
      matches({ organizationId: "org", departmentId: "dept-1", active: true }, where),
    ).toBe(false);
    expect(
      matches({ organizationId: "org", departmentId: "dept-3", active: false }, where),
    ).toBe(false);
  });

  it.each([
    { departmentId: "dept-2", active: false },
    { departmentId: "dept-1", active: true },
    { departmentId: null, active: true },
  ])(
    "does not let a separate admin grant relax PR-only target restrictions: %j",
    async (target) => {
      db.prCenterUser.findFirst.mockResolvedValue({ id: "target", ...target });
      await expect(
        grantRole(mixed, "target", "RTRDA_BORD", "dept-2", "appointment"),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(db.prUserRole.create).not.toHaveBeenCalled();
    },
  );

  it("preserves independent admin authority for an inactive target in admin scope", async () => {
    db.prCenterUser.findFirst.mockResolvedValue({
      id: "target",
      departmentId: "dept-1",
      active: false,
    });
    db.prDepartment.findFirst.mockResolvedValue({ id: "dept-1" });
    await expect(
      grantRole(mixed, "target", "RTRDA_PR", "dept-1", "administrative assignment"),
    ).resolves.toEqual({ id: "new-grant" });
  });
});
