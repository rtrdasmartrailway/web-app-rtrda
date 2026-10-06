import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { prRequest: { findMany: vi.fn() } },
}));
vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));

import { listContentLibraryRequests, type PrCenterActor } from "./service";

const scopedPr: PrCenterActor = {
  id: "pr-user",
  organizationId: "org-1",
  departmentId: "dept-home",
  role: "PR_OPERATIONS",
  roleGrants: [{ role: "PR_OPERATIONS", departmentId: "dept-1" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.prRequest.findMany.mockResolvedValue([]);
});

describe("Content Library request scope", () => {
  it("returns request details only from the PR role's organization and department scope", async () => {
    await listContentLibraryRequests(scopedPr, 50);
    expect(mockPrisma.prRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1", OR: [{ departmentId: "dept-1" }] },
        take: 51,
        include: expect.objectContaining({
          revisions: expect.objectContaining({
            select: expect.objectContaining({
              objective: true,
              audience: true,
              offsiteDetails: true,
            }),
          }),
          sources: { select: { id: true, label: true, url: true, createdAt: true } },
          attachments: expect.objectContaining({
            select: expect.objectContaining({
              file: {
                select: {
                  fileName: true,
                  mimeType: true,
                  sizeBytes: true,
                  scanStatus: true,
                  deletedAt: true,
                },
              },
            }),
          }),
        }),
      }),
    );
    const query = mockPrisma.prRequest.findMany.mock.calls[0][0];
    expect(JSON.stringify(query)).not.toContain("storageKey");
    expect(JSON.stringify(query)).not.toContain("checksum");
  });

  it("uses only the administrator grant scope, preserving organization-wide or department limits", async () => {
    const actor: PrCenterActor = {
      ...scopedPr,
      roleGrants: [{ role: "SCOPED_ADMINISTRATOR", departmentId: "dept-2" }],
    };
    await listContentLibraryRequests(actor);
    expect(mockPrisma.prRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1", OR: [{ departmentId: "dept-2" }] },
      }),
    );
  });

  it("denies requester-only users before querying data", async () => {
    const requester: PrCenterActor = {
      ...scopedPr,
      role: "REQUESTER",
      roleGrants: [{ role: "REQUESTER", departmentId: null }],
    };
    await expect(listContentLibraryRequests(requester)).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
    expect(mockPrisma.prRequest.findMany).not.toHaveBeenCalled();
  });

  it("bounds page size and supports stable cursor pagination", async () => {
    await listContentLibraryRequests(scopedPr, 1000, "cursor-id");
    expect(mockPrisma.prRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 101, cursor: { id: "cursor-id" }, skip: 1 }),
    );
  });
});
