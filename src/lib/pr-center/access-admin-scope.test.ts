import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    prCenterUser: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    prDepartment: { findFirst: vi.fn() },
    prUserRole: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() },
    prAuditEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  mockPrisma.$transaction.mockImplementation((callback) => callback(mockPrisma));
  return { mockPrisma };
});

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));

import {
  grantRole,
  listAdminUsers,
  revokeRole,
  toggleUserActive,
  type PrCenterActor,
} from "./service";

const scopedAdministrator: PrCenterActor = {
  id: "admin-1",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "SCOPED_ADMINISTRATOR",
  roleGrants: [{ role: "SCOPED_ADMINISTRATOR", departmentId: "dept-1" }],
};
const organizationAdministrator: PrCenterActor = {
  id: "org-admin-1",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "SCOPED_ADMINISTRATOR",
  roleGrants: [{ role: "SCOPED_ADMINISTRATOR", departmentId: null }],
  isRootAdministrator: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation((callback) => callback(mockPrisma));
  mockPrisma.prCenterUser.findFirst.mockResolvedValue({
    id: "user-1",
    organizationId: "org-1",
    departmentId: "dept-1",
  });
  mockPrisma.prDepartment.findFirst.mockResolvedValue({ id: "dept-1" });
  mockPrisma.prUserRole.findFirst.mockResolvedValue(null);
  mockPrisma.prUserRole.create.mockResolvedValue({ id: "grant-1" });
  mockPrisma.prUserRole.delete.mockResolvedValue({ id: "grant-1" });
  mockPrisma.prUserRole.count.mockResolvedValue(1);
  mockPrisma.prAuditEvent.create.mockResolvedValue({ id: "audit-1" });
  mockPrisma.prCenterUser.findMany.mockResolvedValue([]);
});

describe("scoped access administration", () => {
  it.each(["", "   ", "x".repeat(1001)])(
    "rejects an empty or oversized access reason",
    async (reason) => {
      await expect(
        grantRole(scopedAdministrator, "user-1", "PR_OPERATIONS", "dept-1", reason),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: reason.trim() ? "INVALID_REASON" : "REASON_REQUIRED",
      });
      expect(mockPrisma.prCenterUser.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.prUserRole.create).not.toHaveBeenCalled();
    },
  );

  it("filters directory users and nested role assignments to the administrator's department", async () => {
    await listAdminUsers(scopedAdministrator);

    expect(mockPrisma.prCenterUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org-1",
          departmentId: { in: ["dept-1"] },
        },
        include: expect.objectContaining({
          roles: {
            where: {
              OR: [{ departmentId: { in: ["dept-1"] } }, { departmentId: null }],
            },
            select: { id: true, role: true, departmentId: true },
          },
        }),
      }),
    );
  });

  it.each([null, "dept-2"])(
    "denies a scoped administrator granting an organization-wide or other-department role (%s)",
    async (departmentId) => {
      await expect(
        grantRole(
          scopedAdministrator,
          "user-1",
          "PR_OPERATIONS",
          departmentId,
          "role assignment",
        ),
      ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
      expect(mockPrisma.prUserRole.create).not.toHaveBeenCalled();
    },
  );

  it("allows an in-scope grant and records the grant scope and actor authority", async () => {
    await grantRole(
      scopedAdministrator,
      "user-1",
      "PR_OPERATIONS",
      "dept-1",
      "coverage assignment",
      "corr-1",
    );

    expect(mockPrisma.prUserRole.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        role: "PR_OPERATIONS",
        organizationId: "org-1",
        departmentId: "dept-1",
      },
    });
    expect(mockPrisma.prAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "access.role_granted",
          correlationId: "corr-1",
          after: expect.objectContaining({
            role: "PR_OPERATIONS",
            departmentId: "dept-1",
            reason: "coverage assignment",
            authorityRoles: [{ role: "SCOPED_ADMINISTRATOR", departmentId: "dept-1" }],
          }),
        }),
      }),
    );
  });

  it("allows only the root administrator to grant a delegated administrator role", async () => {
    await expect(
      grantRole(
        scopedAdministrator,
        "user-2",
        "SCOPED_ADMINISTRATOR",
        "dept-1",
        "admin coverage",
      ),
    ).rejects.toMatchObject({ code: "ROOT_ADMIN_REQUIRED", statusCode: 403 });
    expect(mockPrisma.prUserRole.create).not.toHaveBeenCalled();

    await expect(
      grantRole(
        organizationAdministrator,
        "user-2",
        "SCOPED_ADMINISTRATOR",
        null,
        "delegated admin",
      ),
    ).resolves.toMatchObject({ id: "grant-1" });
    expect(mockPrisma.prUserRole.create).toHaveBeenCalledWith({
      data: {
        userId: "user-2",
        role: "SCOPED_ADMINISTRATOR",
        organizationId: "org-1",
        departmentId: null,
      },
    });
  });

  it("denies revoking an out-of-scope grant before mutation", async () => {
    mockPrisma.prUserRole.findFirst.mockResolvedValue({
      id: "grant-2",
      role: "PR_OPERATIONS",
      organizationId: "org-1",
      departmentId: "dept-2",
      userId: "user-1",
      user: { id: "user-1", displayName: "User", departmentId: "dept-1" },
    });

    await expect(
      revokeRole(scopedAdministrator, "grant-2", "scope correction"),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
    expect(mockPrisma.prUserRole.delete).not.toHaveBeenCalled();
  });

  it("allows revoking an in-scope grant and audits the authority used", async () => {
    mockPrisma.prUserRole.findFirst.mockResolvedValue({
      id: "grant-1",
      role: "PR_OPERATIONS",
      organizationId: "org-1",
      departmentId: "dept-1",
      userId: "user-1",
      user: { id: "user-1", displayName: "User", departmentId: "dept-1" },
    });

    await expect(
      revokeRole(scopedAdministrator, "grant-1", "assignment ended", "corr-2"),
    ).resolves.toEqual({
      id: "grant-1",
      removed: true,
    });
    expect(mockPrisma.$transaction.mock.calls[0]?.[1]).toEqual({
      isolationLevel: "Serializable",
    });
    expect(mockPrisma.prUserRole.delete).toHaveBeenCalledWith({
      where: { id: "grant-1" },
    });
    expect(mockPrisma.prAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "access.role_revoked",
          correlationId: "corr-2",
          before: expect.objectContaining({
            role: "PR_OPERATIONS",
            departmentId: "dept-1",
            reason: "assignment ended",
            authorityRoles: [{ role: "SCOPED_ADMINISTRATOR", departmentId: "dept-1" }],
          }),
        }),
      }),
    );
  });

  it("prevents delegated administrators from revoking administrator roles", async () => {
    mockPrisma.prUserRole.findFirst.mockResolvedValue({
      id: "admin-grant",
      role: "SCOPED_ADMINISTRATOR",
      organizationId: "org-1",
      departmentId: "dept-1",
      userId: "user-2",
      user: { id: "user-2", displayName: "Admin", departmentId: "dept-1", active: true },
    });
    await expect(
      revokeRole(scopedAdministrator, "admin-grant", "change admin"),
    ).rejects.toMatchObject({ code: "ROOT_ADMIN_REQUIRED", statusCode: 403 });
    expect(mockPrisma.prUserRole.delete).not.toHaveBeenCalled();
  });

  it("denies managing a user whose home department is outside the grantor's scope", async () => {
    mockPrisma.prCenterUser.findFirst.mockResolvedValue({
      id: "user-2",
      organizationId: "org-1",
      departmentId: "dept-2",
    });

    await expect(
      grantRole(
        scopedAdministrator,
        "user-2",
        "PR_OPERATIONS",
        "dept-1",
        "role assignment",
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    expect(mockPrisma.prUserRole.create).not.toHaveBeenCalled();
  });

  it("blocks role grants to the administrator's own account", async () => {
    await expect(
      grantRole(
        organizationAdministrator,
        "org-admin-1",
        "PR_OPERATIONS",
        null,
        "role assignment",
      ),
    ).rejects.toMatchObject({ statusCode: 422, code: "SELF_GRANT_BLOCKED" });
    expect(mockPrisma.prCenterUser.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.prUserRole.create).not.toHaveBeenCalled();
  });

  it("prevents revoking the last active organization-wide administrator", async () => {
    mockPrisma.prUserRole.findFirst.mockResolvedValue({
      id: "org-admin-grant",
      role: "SCOPED_ADMINISTRATOR",
      organizationId: "org-1",
      departmentId: null,
      userId: "admin-2",
      user: {
        id: "admin-2",
        displayName: "Admin",
        departmentId: "dept-1",
        active: true,
      },
    });
    mockPrisma.prUserRole.count.mockResolvedValue(0);

    await expect(
      revokeRole(organizationAdministrator, "org-admin-grant", "admin transition"),
    ).rejects.toMatchObject({ statusCode: 422, code: "LAST_ORGANIZATION_ADMIN" });
    expect(mockPrisma.prUserRole.delete).not.toHaveBeenCalled();
    expect(mockPrisma.prAuditEvent.create).not.toHaveBeenCalled();
  });

  it("allows revocation when another active organization-wide administrator remains", async () => {
    mockPrisma.prUserRole.findFirst.mockResolvedValue({
      id: "org-admin-grant",
      role: "SCOPED_ADMINISTRATOR",
      organizationId: "org-1",
      departmentId: null,
      userId: "admin-2",
      user: {
        id: "admin-2",
        displayName: "Admin",
        departmentId: "dept-1",
        active: true,
      },
    });
    mockPrisma.prUserRole.count.mockResolvedValue(1);

    await expect(
      revokeRole(organizationAdministrator, "org-admin-grant", "admin transition"),
    ).resolves.toMatchObject({ removed: true });
    expect(mockPrisma.prUserRole.delete).toHaveBeenCalledWith({
      where: { id: "org-admin-grant" },
    });
  });

  it("stores the reason for user activation in the access audit", async () => {
    mockPrisma.prCenterUser.findFirst.mockResolvedValue({
      id: "user-2",
      organizationId: "org-1",
      departmentId: "dept-1",
      active: false,
    });
    mockPrisma.prCenterUser.update.mockResolvedValue({ id: "user-2", active: true });

    await toggleUserActive(
      organizationAdministrator,
      "user-2",
      "Reactivated after approved leave",
      "corr-activate",
    );

    expect(mockPrisma.prAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "access.user_activated",
          correlationId: "corr-activate",
          after: expect.objectContaining({
            active: true,
            reason: "Reactivated after approved leave",
          }),
        }),
      }),
    );
  });

  it("prevents deactivating the last active organization-wide administrator", async () => {
    mockPrisma.prCenterUser.findFirst.mockResolvedValue({
      id: "admin-2",
      organizationId: "org-1",
      departmentId: "dept-1",
      active: true,
    });
    mockPrisma.prUserRole.findFirst.mockResolvedValue({ id: "org-admin-grant" });
    mockPrisma.prUserRole.count.mockResolvedValue(0);

    await expect(
      toggleUserActive(organizationAdministrator, "admin-2", "account maintenance"),
    ).rejects.toMatchObject({ statusCode: 422, code: "LAST_ORGANIZATION_ADMIN" });
    expect(mockPrisma.prCenterUser.update).not.toHaveBeenCalled();
    expect(mockPrisma.prAuditEvent.create).not.toHaveBeenCalled();
  });

  it("prevents delegated administrators from deactivating another administrator", async () => {
    mockPrisma.prCenterUser.findFirst.mockResolvedValue({
      id: "admin-2",
      organizationId: "org-1",
      departmentId: "dept-1",
      active: true,
      email: "admin-2@rtrda.or.th",
      roles: [{ role: "SCOPED_ADMINISTRATOR", departmentId: "dept-1" }],
    });
    await expect(
      toggleUserActive(scopedAdministrator, "admin-2", "remove access"),
    ).rejects.toMatchObject({ code: "ROOT_ADMIN_REQUIRED", statusCode: 403 });
    expect(mockPrisma.prCenterUser.update).not.toHaveBeenCalled();
  });

  it("protects the designated root administrator account from deactivation", async () => {
    mockPrisma.prCenterUser.findFirst.mockResolvedValue({
      id: "root-admin",
      organizationId: "org-1",
      departmentId: "dept-1",
      active: true,
      email: "admin@apprtrda.onmicrosoft.com",
      roles: [{ role: "SCOPED_ADMINISTRATOR", departmentId: null }],
    });
    await expect(
      toggleUserActive(organizationAdministrator, "root-admin", "remove access"),
    ).rejects.toMatchObject({ code: "ROOT_ADMIN_PROTECTED", statusCode: 422 });
    expect(mockPrisma.prCenterUser.update).not.toHaveBeenCalled();
  });

  it("maps a serializable transaction conflict to a safe stale-write error", async () => {
    mockPrisma.prUserRole.findFirst.mockResolvedValue({
      id: "role-1",
      role: "PR_OPERATIONS",
      organizationId: "org-1",
      departmentId: "dept-1",
      userId: "user-1",
      user: { id: "user-1", displayName: "User", departmentId: "dept-1", active: true },
    });
    mockPrisma.$transaction.mockRejectedValue({ code: "P2034" });

    await expect(
      revokeRole(scopedAdministrator, "role-1", "assignment ended"),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "STALE_ACCESS_ADMIN_WRITE",
    });
  });
});
