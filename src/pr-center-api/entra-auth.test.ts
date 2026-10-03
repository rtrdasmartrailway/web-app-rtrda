import { describe, expect, it } from "vitest";
import { isSessionAuthorityCurrent, validateIdentityMapping } from "./entra-auth";

const identity = {
  id: "user-1",
  active: true,
  organizationId: "org-1",
};

describe("validateIdentityMapping", () => {
  it("keeps an existing SSO subject as the immutable identity when the email changes", () => {
    expect(
      validateIdentityMapping({ ...identity, email: "new@example.com" }, null, "org-1"),
    ).toMatchObject({ id: "user-1" });
  });

  it("rejects email reuse by a different SSO subject", () => {
    expect(() =>
      validateIdentityMapping(null, { ...identity, id: "other-user" }, "org-1"),
    ).toThrow("different SSO identity");
  });

  it("does not let an SSO role reactivate an administratively disabled account", () => {
    expect(() =>
      validateIdentityMapping({ ...identity, active: false }, null, "org-1"),
    ).toThrow("account is disabled");
  });

  it("rejects an identity mapped to another organization", () => {
    expect(() => validateIdentityMapping(identity, identity, "org-2")).toThrow(
      "different organization",
    );
  });
});

describe("isSessionAuthorityCurrent", () => {
  const actor = {
    id: "user-1",
    organizationId: "org-1",
    departmentId: "dept-1",
    role: "REQUESTER" as const,
  };

  it("allows an active user while the same scoped role is assigned", () => {
    expect(
      isSessionAuthorityCurrent(actor, {
        active: true,
        organizationId: "org-1",
        departmentId: "dept-1",
        roles: [{ role: "REQUESTER", organizationId: "org-1", departmentId: "dept-1" }],
      }),
    ).toBe(true);
  });

  it("revokes a session immediately after disable or role removal", () => {
    expect(
      isSessionAuthorityCurrent(actor, {
        active: false,
        organizationId: "org-1",
        departmentId: "dept-1",
        roles: [{ role: "REQUESTER", organizationId: "org-1", departmentId: null }],
      }),
    ).toBe(false);
    expect(
      isSessionAuthorityCurrent(actor, {
        active: true,
        organizationId: "org-1",
        departmentId: "dept-2",
        roles: [{ role: "REQUESTER", organizationId: "org-1", departmentId: null }],
      }),
    ).toBe(false);
    expect(
      isSessionAuthorityCurrent(actor, {
        active: true,
        organizationId: "org-1",
        departmentId: "dept-1",
        roles: [],
      }),
    ).toBe(false);
  });
});
