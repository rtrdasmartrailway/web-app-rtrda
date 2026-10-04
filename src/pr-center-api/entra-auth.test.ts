import { describe, expect, it } from "vitest";
import {
  isAllowedOrganizationEmail,
  isSessionAuthorityCurrent,
  resolvePrCenterLoginRole,
  validateIdentityMapping,
} from "./entra-auth";

describe("organization-domain access and administrator role grants", () => {
  it("allows only a non-empty address at the exact rtrda.or.th domain", () => {
    expect(isAllowedOrganizationEmail("staff@rtrda.or.th")).toBe(true);
    expect(isAllowedOrganizationEmail("STAFF@RTRDA.OR.TH")).toBe(true);
    expect(isAllowedOrganizationEmail("staff@sub.rtrda.or.th")).toBe(false);
    expect(isAllowedOrganizationEmail("staff@rtrda.or.th.evil.test")).toBe(false);
    expect(isAllowedOrganizationEmail("staff@evilrtrda.or.th")).toBe(false);
    expect(isAllowedOrganizationEmail("@rtrda.or.th")).toBe(false);
  });

  it("gives a domain-approved user without a role the least-privilege requester role", () => {
    expect(resolvePrCenterLoginRole("staff@rtrda.or.th", [])).toEqual({
      role: "REQUESTER",
      roleGrants: [{ role: "REQUESTER", departmentId: null }],
      autoProvisionRequester: true,
    });
  });

  it("uses an administrator-granted database role instead of auto-provisioning", () => {
    expect(
      resolvePrCenterLoginRole("staff@rtrda.or.th", [
        { role: "PR_OPERATIONS", departmentId: null },
      ]),
    ).toEqual({
      role: "PR_OPERATIONS",
      roleGrants: [
        { role: "PR_OPERATIONS", departmentId: null },
        { role: "REQUESTER", departmentId: null },
      ],
      autoProvisionRequester: true,
    });
  });

  it("blocks non-domain accounts even when a database role was granted", () => {
    expect(() =>
      resolvePrCenterLoginRole("staff@outside.example", [
        { role: "SCOPED_ADMINISTRATOR", departmentId: null },
      ]),
    ).toThrow(
      expect.objectContaining({ code: "OIDC_ACCESS_NOT_ALLOWED", statusCode: 403 }),
    );
  });
});

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
        email: "staff@rtrda.or.th",
        organizationId: "org-1",
        departmentId: "dept-1",
        roles: [{ role: "REQUESTER", organizationId: "org-1", departmentId: "dept-1" }],
      }),
    ).toBe(true);
  });

  it("preserves organization-wide PR authority independently of the user's home department", () => {
    const organizationPrActor = {
      ...actor,
      role: "PR_OPERATIONS" as const,
      scopeDepartmentId: null,
    };
    expect(
      isSessionAuthorityCurrent(organizationPrActor, {
        active: true,
        email: "staff@rtrda.or.th",
        organizationId: "org-1",
        departmentId: "dept-1",
        roles: [{ role: "PR_OPERATIONS", organizationId: "org-1", departmentId: null }],
      }),
    ).toBe(true);
    expect(
      isSessionAuthorityCurrent(organizationPrActor, {
        active: true,
        email: "staff@rtrda.or.th",
        organizationId: "org-1",
        departmentId: "dept-1",
        roles: [
          { role: "PR_OPERATIONS", organizationId: "org-1", departmentId: "dept-2" },
        ],
      }),
    ).toBe(false);
    const departmentPrActor = {
      ...organizationPrActor,
      scopeDepartmentId: "dept-1",
    };
    expect(
      isSessionAuthorityCurrent(departmentPrActor, {
        active: true,
        email: "staff@rtrda.or.th",
        organizationId: "org-1",
        departmentId: "dept-1",
        roles: [{ role: "PR_OPERATIONS", organizationId: "org-1", departmentId: null }],
      }),
    ).toBe(false);
  });

  it("revokes a session immediately after disable or role removal", () => {
    expect(
      isSessionAuthorityCurrent(actor, {
        active: false,
        email: "staff@rtrda.or.th",
        organizationId: "org-1",
        departmentId: "dept-1",
        roles: [{ role: "REQUESTER", organizationId: "org-1", departmentId: null }],
      }),
    ).toBe(false);
    expect(
      isSessionAuthorityCurrent(actor, {
        active: true,
        email: "staff@rtrda.or.th",
        organizationId: "org-1",
        departmentId: "dept-2",
        roles: [{ role: "REQUESTER", organizationId: "org-1", departmentId: null }],
      }),
    ).toBe(false);
    expect(
      isSessionAuthorityCurrent(actor, {
        active: true,
        email: "staff@rtrda.or.th",
        organizationId: "org-1",
        departmentId: "dept-1",
        roles: [],
      }),
    ).toBe(false);
  });

  it("preserves all assigned roles and scopes and invalidates the session when any grant changes", () => {
    const roleGrants = [
      { role: "REQUESTER" as const, departmentId: null },
      { role: "PR_OPERATIONS" as const, departmentId: "dept-2" },
      { role: "APPROVER" as const, departmentId: "dept-3" },
    ];
    const multiRoleActor = {
      ...actor,
      role: "PR_OPERATIONS" as const,
      roleGrants,
    };
    const currentUser = {
      active: true,
      email: "staff@rtrda.or.th",
      organizationId: "org-1",
      departmentId: "dept-1",
      roles: roleGrants.map((grant) => ({ ...grant, organizationId: "org-1" })),
    };
    expect(isSessionAuthorityCurrent(multiRoleActor, currentUser)).toBe(true);
    expect(
      isSessionAuthorityCurrent(multiRoleActor, {
        ...currentUser,
        roles: currentUser.roles.filter((grant) => grant.role !== "APPROVER"),
      }),
    ).toBe(false);
    expect(
      isSessionAuthorityCurrent(multiRoleActor, {
        ...currentUser,
        roles: currentUser.roles.map((grant) =>
          grant.role === "PR_OPERATIONS" ? { ...grant, departmentId: "dept-4" } : grant,
        ),
      }),
    ).toBe(false);
  });
});
