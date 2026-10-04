import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    prFileObject: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    prRequest: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      count: vi.fn(),
    },
    prAuditEvent: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
    prStatusHistory: { create: vi.fn() },
    prOutboxEvent: { create: vi.fn() },
    prApproval: { count: vi.fn() },
    prNotification: { count: vi.fn() },
    prUserRole: { count: vi.fn() },
    $transaction: vi.fn(),
  };
  mockPrisma.$transaction.mockImplementation((callback) => callback(mockPrisma));
  return { mockPrisma };
});

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));

import {
  exportAuditEvents,
  listQuarantinedFiles,
  releaseReadinessCheck,
  restoreRequest,
  type PrCenterActor,
} from "./service";

const scopedPr: PrCenterActor = {
  id: "pr-1",
  organizationId: "org-1",
  departmentId: "dept-home",
  role: "PR_OPERATIONS",
  roleGrants: [{ role: "PR_OPERATIONS", departmentId: "dept-1" }],
};
const scopedAdmin: PrCenterActor = {
  id: "admin-1",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "SCOPED_ADMINISTRATOR",
  roleGrants: [{ role: "SCOPED_ADMINISTRATOR", departmentId: "dept-1" }],
};
const organizationAdmin: PrCenterActor = {
  id: "org-admin-1",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "SCOPED_ADMINISTRATOR",
  roleGrants: [{ role: "SCOPED_ADMINISTRATOR", departmentId: null }],
};
const requestScope = {
  organizationId: "org-1",
  departmentId: { in: ["dept-1"] },
};
const scopedAttachment = {
  OR: [
    { request: { is: requestScope } },
    { task: { is: { request: { is: requestScope } } } },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation((callback) => callback(mockPrisma));
  mockPrisma.prFileObject.findMany.mockResolvedValue([]);
  mockPrisma.prFileObject.findFirst.mockResolvedValue(null);
  mockPrisma.prRequest.findFirst.mockResolvedValue(null);
  mockPrisma.prRequest.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.prRequest.findUniqueOrThrow.mockResolvedValue({
    id: "request-1",
    status: "DRAFT",
  });
  mockPrisma.prAuditEvent.findMany.mockResolvedValue([]);
});

describe("scope-sensitive file and audit operations", () => {
  it("filters quarantine lists and attachment details to the PR grant's department", async () => {
    await listQuarantinedFiles(scopedPr);

    expect(mockPrisma.prFileObject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          attachments: { some: scopedAttachment, every: scopedAttachment },
        }),
        include: {
          attachments: {
            where: scopedAttachment,
            select: {
              id: true,
              kind: true,
              version: true,
              requestId: true,
              taskId: true,
            },
          },
        },
      }),
    );
  });

  it("denies organization-wide audit export and readiness to a department-scoped administrator", async () => {
    await expect(exportAuditEvents(scopedAdmin, {})).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
    await expect(releaseReadinessCheck(scopedAdmin)).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
    expect(mockPrisma.prAuditEvent.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.prAuditEvent.count).not.toHaveBeenCalled();
  });

  it("audits the filters and effective organization-wide grant on successful exports", async () => {
    const filters = { entityType: "request", from: "2026-01-01" };
    await expect(
      exportAuditEvents(organizationAdmin, filters, "corr-export"),
    ).resolves.toMatchObject({ count: 0, filters });

    expect(mockPrisma.prAuditEvent.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        actorId: "org-admin-1",
        action: "audit.exported",
        entityType: "audit_export",
        entityId: "corr-export",
        correlationId: "corr-export",
        after: {
          filters,
          count: 0,
          authorityRoles: [{ role: "SCOPED_ADMINISTRATOR", departmentId: null }],
        },
      },
    });
  });

  it("scopes restore lookup and conditional write to the administrator grant", async () => {
    mockPrisma.prRequest.findFirst.mockResolvedValue({
      id: "request-1",
      organizationId: "org-1",
      departmentId: "dept-1",
      status: "WITHDRAWN",
      version: 4,
    });

    await restoreRequest(
      scopedAdmin,
      "request-1",
      4,
      "Restore after review",
      "corr-restore",
    );

    expect(mockPrisma.prRequest.findFirst).toHaveBeenCalledWith({
      where: {
        id: "request-1",
        organizationId: "org-1",
        OR: [{ departmentId: "dept-1" }],
      },
    });
    expect(mockPrisma.prRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: "request-1",
        version: 4,
        organizationId: "org-1",
        OR: [{ departmentId: "dept-1" }],
      },
      data: { status: "DRAFT", version: { increment: 1 } },
    });
  });
});
