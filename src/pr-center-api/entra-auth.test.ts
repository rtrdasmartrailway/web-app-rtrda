import { describe, expect, it } from "vitest";
import {
  isAllowedOrganizationEmail,
  isSessionAuthorityCurrent,
  resolvePrCenterLoginRole,
  validateIdentityMapping,
} from "./entra-auth";

describe("organization-domain requester access", () => {
  it("allows only a non-empty address at the exact rtrda.or.th domain", () => {
    expect(isAllowedOrganizationEmail("staff@rtrda.or.th")).toBe(true);
    expect(isAllowedOrganizationEmail("STAFF@RTRDA.OR.TH")).toBe(true);
    expect(isAllowedOrganizationEmail("staff@sub.rtrda.or.th")).toBe(false);
    expect(isAllowedOrganizationEmail("staff@rtrda.or.th.evil.test")).toBe(false);
    expect(isAllowedOrganizationEmail("staff@evilrtrda.or.th")).toBe(false);
    expect(isAllowedOrganizationEmail("@rtrda.or.th")).toBe(false);
  });

  it("gives a domain-approved user without a role the least-privilege requester role", () => {
    expect(resolvePrCenterLoginRole("staff@rtrda.or.th", undefined, undefined)).toEqual({
      role: "REQUESTER",
      autoProvisionRequester: true,
    });
  });

  it("preserves an existing explicit role instead of auto-provisioning", () => {
    expect(
      resolvePrCenterLoginRole("staff@rtrda.or.th", undefined, {
        role: "PR_OPERATIONS",
        departmentId: null,
      }),
    ).toEqual({ role: "PR_OPERATIONS", autoProvisionRequester: false });
  });

  it("blocks even a role-assigned account when its email is outside the organization domain", () => {
    expect(() =>
      resolvePrCenterLoginRole(
        "staff@outside.example",
        "SCOPED_ADMINISTRATOR",
        undefined,
      ),
    ).toThrow(
      expect.objectContaining({ code: "OIDC_DOMAIN_NOT_ALLOWED", statusCode: 403 }),
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
        organizationId: "org-1",
        departmentId: "dept-1",
        roles: [{ role: "PR_OPERATIONS", organizationId: "org-1", departmentId: null }],
      }),
    ).toBe(true);
    expect(
      isSessionAuthorityCurrent(organizationPrActor, {
        active: true,
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
