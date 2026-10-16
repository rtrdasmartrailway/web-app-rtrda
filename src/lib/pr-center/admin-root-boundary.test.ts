import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({
  db: {
    prCenterUser: { findFirst: vi.fn(), updateMany: vi.fn() },
    prDepartment: { findFirst: vi.fn() },
    prUserRole: {
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    prAuditEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/db/client", () => ({ prisma: db }));

import { isRootPrCenterAdministrator } from "./access-authority";
import { isSessionAuthorityCurrent } from "../../pr-center-api/entra-auth";
import {
  grantRole,
  revokeRole,
  toggleUserActive,
  type PrCenterActor,
  type PrCenterRoleGrant,
} from "./service";

type User = {
  id: string;
  organizationId: string;
  departmentId: string | null;
  email: string;
  displayName: string;
  active: boolean;
};
type Grant = PrCenterRoleGrant & {
  id: string;
  organizationId: string;
  userId: string;
};
type State = {
  users: User[];
  grants: Grant[];
  audits: Record<string, unknown>[];
};
type RecordValue = Record<string, unknown>;

// Interpret the actual source predicates, reject unknown operators, and honor
// relation select/include. A findFirst never returns an unrelated canned row.
function matches(row: RecordValue, where: RecordValue): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "AND" || key === "OR") {
      const clauses = Array.isArray(condition) ? condition : [condition];
      const results = clauses.map((clause) => matches(row, clause));
      return key === "AND" ? results.every(Boolean) : results.some(Boolean);
    }
    if (!(key in row)) throw new Error(`Unsupported field: ${key}`);
    const value = row[key];
    if (condition !== null && typeof condition === "object") {
      const object = condition as RecordValue;
      if ("not" in object) return value !== object.not;
      if ("in" in object) return (object.in as unknown[]).includes(value);
      if (Array.isArray(value)) {
        if ("none" in object)
          return !value.some((item) => matches(item, object.none as RecordValue));
        if ("some" in object)
          return value.some((item) => matches(item, object.some as RecordValue));
        throw new Error(`Unsupported array predicate: ${key}`);
      }
      if (value === null || typeof value !== "object") return false;
      return matches(value as RecordValue, object);
    }
    return value === condition;
  });
}
function project(row: RecordValue, select?: RecordValue): RecordValue {
  if (!select) return structuredClone(row);
  return Object.fromEntries(
    Object.entries(select).map(([key, selection]) => {
      if (!(key in row)) throw new Error(`Unsupported projection: ${key}`);
      const value = row[key];
      if (selection === true) return [key, structuredClone(value)];
      const nested = selection as { where?: RecordValue; select?: RecordValue };
      return [
        key,
        Array.isArray(value)
          ? value
              .filter((item) => !nested.where || matches(item, nested.where))
              .map((item) => project(item, nested.select))
          : project(value as RecordValue, nested.select),
      ];
    }),
  );
}
let state: State;
let revision: number;
let beforeTransaction: (() => void) | undefined;
let loseWrite: "user" | "grant" | undefined;

function user(id = "target", overrides: Partial<User> = {}): User {
  return {
    id,
    organizationId: "org",
    departmentId: "dept-1",
    email: `${id}@rtrda.or.th`,
    displayName: id,
    active: true,
    ...overrides,
  };
}
function grant(id: string, overrides: Partial<Grant> = {}): Grant {
  return {
    id,
    userId: "target",
    organizationId: "org",
    role: "RTRDA_PR",
    departmentId: "dept-1",
    ...overrides,
  };
}
function actor(
  grants: PrCenterRoleGrant[] = [{ role: "RTRDA_ADMIN", departmentId: "dept-1" }],
  root = false,
): PrCenterActor {
  return {
    id: "operator",
    organizationId: "org",
    departmentId: "dept-1",
    role: "RTRDA_ADMIN",
    roleGrants: grants,
    isRootAdministrator: root,
  };
}
const root = () => actor([{ role: "RTRDA_ADMIN", departmentId: null }], true);

function client(read: () => State, instrument = false) {
  const wrap = <T extends (...args: never[]) => unknown>(fn: T) =>
    instrument ? vi.fn(fn) : fn;
  const users = () =>
    read().users.map((record) => ({
      ...record,
      roles: read().grants.filter((item) => item.userId === record.id),
    }));
  const grants = () =>
    read().grants.map((record) => ({
      ...record,
      user: read().users.find((item) => item.id === record.userId) ?? null,
    }));
  type Query = { where: RecordValue; select?: RecordValue; include?: RecordValue };
  const first = (rows: RecordValue[], query: Query) => {
    const row = rows.find((item) => matches(item, query.where));
    if (!row) return Promise.resolve(null);
    if (query.select) return Promise.resolve(project(row, query.select));
    const scalar = Object.fromEntries(
      Object.entries(row).filter(([key]) => key !== "user" && key !== "roles"),
    );
    return Promise.resolve({
      ...structuredClone(scalar),
      ...(query.include ? project(row, query.include) : {}),
    });
  };
  return {
    prCenterUser: {
      findFirst: wrap((query: Query) => first(users(), query)),
      updateMany: wrap(({ where, data }: Query & { data: Partial<User> }) => {
        const ids =
          loseWrite === "user"
            ? []
            : users()
                .filter((row) => matches(row, where))
                .map((row) => row.id);
        read().users.forEach((row) => {
          if (ids.includes(row.id)) Object.assign(row, data);
        });
        return Promise.resolve({ count: ids.length });
      }),
    },
    prDepartment: {
      findFirst: wrap((query: Query) =>
        first(
          [
            { id: "dept-1", organizationId: "org" },
            { id: "dept-2", organizationId: "org" },
            { id: "foreign-dept", organizationId: "foreign" },
          ],
          query,
        ),
      ),
    },
    prUserRole: {
      findFirst: wrap((query: Query) => first(grants(), query)),
      count: wrap(({ where }: Query) =>
        Promise.resolve(grants().filter((row) => matches(row, where)).length),
      ),
      create: wrap(({ data }: { data: Omit<Grant, "id"> }) => {
        const record = { id: `created-${read().grants.length}`, ...data };
        read().grants.push(record);
        return Promise.resolve(record);
      }),
      deleteMany: wrap(({ where }: Query) => {
        const ids =
          loseWrite === "grant"
            ? []
            : grants()
                .filter((row) => matches(row, where))
                .map((row) => row.id);
        read().grants = read().grants.filter((row) => !ids.includes(row.id));
        return Promise.resolve({ count: ids.length });
      }),
    },
    prAuditEvent: {
      create: wrap(({ data }: { data: RecordValue }) => {
        read().audits.push(data);
        return Promise.resolve(data);
      }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state = { users: [user()], grants: [], audits: [] };
  revision = 0;
  beforeTransaction = undefined;
  loseWrite = undefined;
  const outside = client(() => state);
  for (const model of [
    "prCenterUser",
    "prDepartment",
    "prUserRole",
    "prAuditEvent",
  ] as const) {
    for (const [method, implementation] of Object.entries(outside[model])) {
      (db[model] as Record<string, ReturnType<typeof vi.fn>>)[method].mockImplementation(
        implementation,
      );
    }
  }
  // Deliberate optimistic Serializable model: callbacks use isolated snapshots;
  // a concurrent commit rejects the stale transaction (including its audit).
  // This is NOT a live PostgreSQL concurrency test.
  db.$transaction.mockImplementation(async (callback, options) => {
    expect(options).toEqual({ isolationLevel: "Serializable" });
    beforeTransaction?.();
    const start = revision;
    const snapshot = structuredClone(state);
    const result = await callback(client(() => snapshot));
    if (start !== revision) throw { code: "P2034" };
    state = snapshot;
    revision += 1;
    return result;
  });
});

const denied = (code = "FORBIDDEN", statusCode = 403) => ({ code, statusCode });

describe("explicit account status intent is safe to retry", () => {
  it.each([false, true])(
    "preserves desired active=%s on an identical replay",
    async (active) => {
      state.users[0].active = !active;
      await expect(
        toggleUserActive(actor(), "target", "reviewed", "first", active),
      ).resolves.toEqual({ id: "target", active });
      await expect(
        toggleUserActive(actor(), "target", "reviewed", "retry", active),
      ).resolves.toEqual({ id: "target", active });
      expect(state.users[0].active).toBe(active);
      expect(state.audits).toHaveLength(1);
      expect(state.audits[0].after).toMatchObject({ active, reason: "reviewed" });
    },
  );
  it.each([[null], ["false"], [0], [{}], [[]]])(
    "rejects invalid explicit status %j before database access",
    async (value) => {
      await expect(
        toggleUserActive(actor(), "target", "reason", "invalid", value),
      ).rejects.toMatchObject(denied("INVALID_ACTIVE_STATUS", 422));
      expect(db.prCenterUser.findFirst).not.toHaveBeenCalled();
      expect(state.audits).toEqual([]);
    },
  );
  it("reauthorizes a no-op rather than leaking target state or bypassing root protection", async () => {
    await expect(
      toggleUserActive(
        actor([{ role: "RTRDA_ADMIN", departmentId: "dept-2" }]),
        "target",
        "reason",
        "outside",
        true,
      ),
    ).rejects.toMatchObject(denied());
    state.users[0].email = "admin@apprtrda.onmicrosoft.com";
    await expect(
      toggleUserActive(root(), "target", "reason", "root", true),
    ).rejects.toMatchObject(denied("ROOT_ADMIN_PROTECTED", 422));
    expect(state.audits).toEqual([]);
  });
  it("forwards explicit false through the API and preserves it on replay", async () => {
    const { buildPrCenterApi } = await import("../../pr-center-api/app");
    const app = buildPrCenterApi(async () => actor());
    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await app.inject({
          method: "PATCH",
          url: "/admin/users/target/active",
          payload: { reason: "reviewed", active: false },
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ id: "target", active: false });
      }
      expect(state.users[0].active).toBe(false);
      expect(state.audits).toHaveLength(1);
    } finally {
      await app.close();
    }
  });
});

describe("exact root identity and trusted actor boundary", () => {
  it.each([
    ["admin@apprtrda.onmicrosoft.com", true],
    [" ADMIN@APPRTRDA.ONMICROSOFT.COM ", true],
    ["other@apprtrda.onmicrosoft.com", false],
    ["admin@apprtrda.onmicrosoft.com.evil.test", false],
    ["admin@rtrda.or.th", false],
    [undefined, false],
  ])("recognizes only normalized canonical root: %s", (email, expected) => {
    expect(isRootPrCenterAdministrator(email)).toBe(expected);
  });

  it("middleware rejects a spoofed root flag against authoritative account email", () => {
    const authority = {
      ...user("operator"),
      roles: [
        grant("operator-admin", {
          userId: "operator",
          role: "RTRDA_ADMIN",
          departmentId: null,
        }),
      ],
    };
    expect(isSessionAuthorityCurrent(root(), authority)).toBe(false);
    expect(
      isSessionAuthorityCurrent(root(), {
        ...authority,
        email: "admin@apprtrda.onmicrosoft.com",
      }),
    ).toBe(true);
  });

  it.each([
    { grants: [] as PrCenterRoleGrant[] },
    { grants: [{ role: "RTRDA_ALL_USER", departmentId: null }] as PrCenterRoleGrant[] },
  ])(
    "display ADMIN and arbitrary root flag confer no authority with grants $grants",
    async ({ grants }) => {
      const spoof = actor(grants, true);
      state.grants = [grant("assignment")];
      await expect(
        grantRole(spoof, "target", "RTRDA_ADMIN", null, "reason"),
      ).rejects.toMatchObject(denied());
      await expect(revokeRole(spoof, "assignment", "reason")).rejects.toMatchObject(
        denied(),
      );
      await expect(toggleUserActive(spoof, "target", "reason")).rejects.toMatchObject(
        denied(),
      );
      expect(state.audits).toEqual([]);
      expect(state.users[0].active).toBe(true);
      expect(state.grants).toHaveLength(1);
    },
  );

  it("does not treat root identity as an organization-wide grant", async () => {
    const scopedRoot = actor(undefined, true);
    await expect(
      grantRole(scopedRoot, "target", "RTRDA_ADMIN", null, "reason"),
    ).rejects.toMatchObject(denied());
    state.users[0].departmentId = "dept-2";
    await expect(toggleUserActive(scopedRoot, "target", "reason")).rejects.toMatchObject(
      denied(),
    );
    expect(state.audits).toEqual([]);
  });
});

describe("administrator mutations and independent grants", () => {
  it("nonroot cannot grant or revoke ADMIN even in its own scope", async () => {
    state.grants = [grant("admin", { role: "RTRDA_ADMIN" })];
    await expect(
      grantRole(actor(), "target", "RTRDA_ADMIN", "dept-1", "reason"),
    ).rejects.toMatchObject(denied("ROOT_ADMIN_REQUIRED"));
    await expect(revokeRole(actor(), "admin", "reason")).rejects.toMatchObject(
      denied("ROOT_ADMIN_REQUIRED"),
    );
    expect(state.grants).toHaveLength(1);
    expect(state.audits).toEqual([]);
  });

  it.each([true, false])("nonroot cannot toggle an admin, active=%s", async (active) => {
    state.users[0].active = active;
    state.grants = [
      grant("other-department-admin", { role: "RTRDA_ADMIN", departmentId: "dept-2" }),
    ];
    await expect(toggleUserActive(actor(), "target", "reason")).rejects.toMatchObject(
      denied("ROOT_ADMIN_REQUIRED"),
    );
    expect(state.users[0].active).toBe(active);
    expect(state.audits).toEqual([]);
  });

  it("root can manage a delegated admin and audit normalized reason/correlation", async () => {
    await grantRole(
      root(),
      "target",
      "RTRDA_ADMIN",
      "dept-1",
      "  coverage  ",
      "corr-grant",
    );
    const id = state.grants[0].id;
    await toggleUserActive(root(), "target", "  approved leave  ", "corr-toggle");
    await revokeRole(root(), id, "  ended  ", "corr-revoke");
    expect(state.grants).toEqual([]);
    expect(state.users[0].active).toBe(false);
    expect(state.audits).toMatchObject([
      {
        action: "access.role_granted",
        correlationId: "corr-grant",
        after: { reason: "coverage", authorityRoles: root().roleGrants },
      },
      {
        action: "access.user_deactivated",
        correlationId: "corr-toggle",
        after: { reason: "approved leave" },
      },
      {
        action: "access.role_revoked",
        correlationId: "corr-revoke",
        before: { reason: "ended" },
      },
    ]);
  });

  it("protects the root account and assignments from disable/revoke", async () => {
    state.users[0].email = "admin@apprtrda.onmicrosoft.com";
    state.grants = [grant("root-admin", { role: "RTRDA_ADMIN", departmentId: null })];
    await expect(toggleUserActive(root(), "target", "reason")).rejects.toMatchObject(
      denied("ROOT_ADMIN_PROTECTED", 422),
    );
    await expect(revokeRole(root(), "root-admin", "reason")).rejects.toMatchObject(
      denied("ROOT_ADMIN_PROTECTED", 422),
    );
    expect(state.audits).toEqual([]);
  });

  it("grant/revoke preserves independent role/scope tuples", async () => {
    state.grants = [
      grant("pr-one"),
      grant("pr-two", { departmentId: "dept-2" }),
      grant("board", { role: "RTRDA_BORD", departmentId: null }),
    ];
    await grantRole(root(), "target", "RTRDA_PR", null, "organization coverage");
    await expect(
      grantRole(root(), "target", "RTRDA_PR", "dept-1", "duplicate"),
    ).rejects.toMatchObject(denied("ROLE_ALREADY_ASSIGNED", 409));
    await revokeRole(root(), "pr-one", "only this tuple");
    expect(
      state.grants.map(({ role, departmentId }) => ({ role, departmentId })),
    ).toEqual([
      { role: "RTRDA_PR", departmentId: "dept-2" },
      { role: "RTRDA_BORD", departmentId: null },
      { role: "RTRDA_PR", departmentId: null },
    ]);
    expect(state.audits).toHaveLength(2);
  });

  it("unrelated global PR does not widen a department ADMIN scope", async () => {
    const mixed = actor([
      { role: "RTRDA_ADMIN", departmentId: "dept-1" },
      { role: "RTRDA_PR", departmentId: null },
    ]);
    state.users[0].departmentId = "dept-2";
    state.grants = [grant("pr", { departmentId: "dept-2" })];
    await expect(
      grantRole(mixed, "target", "RTRDA_PR", "dept-2", "reason"),
    ).rejects.toMatchObject(denied());
    await expect(revokeRole(mixed, "pr", "reason")).rejects.toMatchObject(denied());
    await expect(toggleUserActive(mixed, "target", "reason")).rejects.toMatchObject(
      denied(),
    );
    expect(state.audits).toEqual([]);
  });

  it("root remains organization scoped for all actions", async () => {
    state.users[0].organizationId = "foreign";
    state.grants = [grant("foreign", { organizationId: "foreign" })];
    await expect(
      grantRole(root(), "target", "RTRDA_ADMIN", null, "reason"),
    ).rejects.toMatchObject(denied("NOT_FOUND", 404));
    await expect(revokeRole(root(), "foreign", "reason")).rejects.toMatchObject(
      denied("NOT_FOUND", 404),
    );
    await expect(toggleUserActive(root(), "target", "reason")).rejects.toMatchObject(
      denied("NOT_FOUND", 404),
    );
    expect(state.audits).toEqual([]);
  });

  it.each([undefined, "", "   ", "x".repeat(1001)])(
    "requires a bounded reason for every mutation (%s)",
    async (reason) => {
      const expected = denied(
        typeof reason === "string" && reason.trim()
          ? "INVALID_REASON"
          : "REASON_REQUIRED",
        422,
      );
      await expect(
        grantRole(root(), "target", "RTRDA_PR", null, reason),
      ).rejects.toMatchObject(expected);
      await expect(revokeRole(root(), "assignment", reason)).rejects.toMatchObject(
        expected,
      );
      await expect(toggleUserActive(root(), "target", reason)).rejects.toMatchObject(
        expected,
      );
      expect(db.$transaction).not.toHaveBeenCalled();
      expect(state.audits).toEqual([]);
    },
  );
});

describe("last active organization administrator and Serializable writes", () => {
  it.each(["revoke", "disable"])(
    "protects the last organization administrator on %s",
    async (operation) => {
      state.grants = [
        grant("last", { role: "RTRDA_ADMIN", departmentId: null }),
        grant("scoped-only", { role: "RTRDA_ADMIN" }),
        grant("inactive", {
          userId: "inactive",
          role: "RTRDA_ADMIN",
          departmentId: null,
        }),
        grant("other-org", {
          userId: "other",
          organizationId: "foreign",
          role: "RTRDA_ADMIN",
          departmentId: null,
        }),
      ];
      state.users.push(
        user("inactive", { active: false }),
        user("other", { organizationId: "foreign" }),
      );
      const action =
        operation === "revoke"
          ? revokeRole(root(), "last", "reason")
          : toggleUserActive(root(), "target", "reason");
      await expect(action).rejects.toMatchObject(denied("LAST_ORGANIZATION_ADMIN", 422));
      expect(state.users[0].active).toBe(true);
      expect(state.grants).toHaveLength(4);
      expect(state.audits).toEqual([]);
    },
  );

  it.each(["revoke", "disable"])(
    "a mismatched-organization user cannot count as a remaining admin on %s",
    async (operation) => {
      state.users.push(user("foreign", { organizationId: "foreign" }));
      state.grants = [
        grant("last", { role: "RTRDA_ADMIN", departmentId: null }),
        grant("mismatched", {
          userId: "foreign",
          role: "RTRDA_ADMIN",
          departmentId: null,
        }),
      ];
      const action =
        operation === "revoke"
          ? revokeRole(root(), "last", "reason")
          : toggleUserActive(root(), "target", "reason");
      await expect(action).rejects.toMatchObject(denied("LAST_ORGANIZATION_ADMIN", 422));
      expect(state.audits).toEqual([]);
    },
  );

  it("concurrent deactivations cannot remove both active organization administrators", async () => {
    state.users.push(user("second"));
    state.grants = [
      grant("first", { role: "RTRDA_ADMIN", departmentId: null }),
      grant("second", { userId: "second", role: "RTRDA_ADMIN", departmentId: null }),
    ];
    // Root has only department ADMIN authority, which permits toggling these
    // department users but is not itself a remaining organization-wide grant.
    const scopedRoot = actor(undefined, true);
    const results = await Promise.allSettled([
      toggleUserActive(scopedRoot, "target", "first leave"),
      toggleUserActive(scopedRoot, "second", "second leave"),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: denied("STALE_ACCESS_ADMIN_WRITE", 409),
    });
    expect(state.users.filter((record) => record.active)).toHaveLength(1);
    expect(state.audits).toHaveLength(1);
    const remaining = state.users.find((record) => record.active)!;
    await expect(
      toggleUserActive(scopedRoot, remaining.id, "retry"),
    ).rejects.toMatchObject(denied("LAST_ORGANIZATION_ADMIN", 422));
  });

  it("allows removing an inactive organization-admin assignment without a survivor", async () => {
    state.users[0].active = false;
    state.grants = [grant("inactive", { role: "RTRDA_ADMIN", departmentId: null })];
    await expect(revokeRole(root(), "inactive", "cleanup")).resolves.toMatchObject({
      removed: true,
    });
    expect(state.grants).toEqual([]);
  });

  it("rechecks newly assigned ADMIN roles inside the transaction", async () => {
    beforeTransaction = () => {
      state.grants.push(grant("new-admin", { role: "RTRDA_ADMIN" }));
    };
    await expect(toggleUserActive(actor(), "target", "reason")).rejects.toMatchObject(
      denied("ROOT_ADMIN_REQUIRED"),
    );
    expect(state.users[0].active).toBe(true);
    expect(state.audits).toEqual([]);
  });

  it.each(["grant", "revoke", "toggle"])(
    "rechecks moved target inside transaction: %s",
    async (operation) => {
      state.grants = [grant("assignment")];
      beforeTransaction = () => {
        state.users[0].departmentId = "dept-2";
      };
      const action =
        operation === "grant"
          ? grantRole(actor(), "target", "RTRDA_PR", "dept-1", "reason")
          : operation === "revoke"
            ? revokeRole(actor(), "assignment", "reason")
            : toggleUserActive(actor(), "target", "reason");
      await expect(action).rejects.toMatchObject(denied());
      expect(state.audits).toEqual([]);
    },
  );

  it.each(["user", "grant"] as const)(
    "zero-count conditional %s write emits no success audit",
    async (kind) => {
      loseWrite = kind;
      state.grants = [grant("assignment")];
      const action =
        kind === "user"
          ? toggleUserActive(actor(), "target", "reason")
          : revokeRole(actor(), "assignment", "reason");
      await expect(action).rejects.toMatchObject(denied("STALE_ACCESS_ADMIN_WRITE", 409));
      expect(state.audits).toEqual([]);
      expect(state.users[0].active).toBe(true);
      expect(state.grants).toHaveLength(1);
    },
  );
});
