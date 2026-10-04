import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, readFromStorage } = vi.hoisted(() => ({
  mockPrisma: {
    prFileObject: { findFirst: vi.fn() },
    prAttachment: { findFirst: vi.fn() },
  },
  readFromStorage: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));
vi.mock("./file-storage", async () => {
  const actual = await vi.importActual<typeof import("./file-storage")>("./file-storage");
  return { ...actual, readFileFromStorage: readFromStorage };
});

import { downloadFile, type PrCenterActor } from "./service";

const scopedPr: PrCenterActor = {
  id: "pr-1",
  organizationId: "org-1",
  departmentId: "dept-home",
  role: "PR_OPERATIONS",
  roleGrants: [
    { role: "REQUESTER", departmentId: null },
    { role: "PR_OPERATIONS", departmentId: "dept-1" },
  ],
};

const attachmentFor = (departmentId: string, requesterId = "owner-1") => ({
  request: { organizationId: "org-1", departmentId, requesterId },
  task: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.prFileObject.findFirst.mockResolvedValue({
    id: "file-1",
    organizationId: "org-1",
    deletedAt: null,
    scanStatus: "CLEAN",
    storageKey: "private/file-1",
    fileName: "brief.pdf",
    mimeType: "application/pdf",
  });
  mockPrisma.prAttachment.findFirst.mockResolvedValue(attachmentFor("dept-1"));
  readFromStorage.mockResolvedValue(Buffer.from("clean file bytes"));
});

describe("file download request scope", () => {
  it("allows PR access only in the department attached to its PR grant", async () => {
    mockPrisma.prAttachment.findFirst.mockResolvedValue(attachmentFor("dept-1"));
    await expect(downloadFile(scopedPr, "file-1")).resolves.toMatchObject({
      fileName: "brief.pdf",
      mimeType: "application/pdf",
    });
    expect(readFromStorage).toHaveBeenCalledWith("org-1", "private/file-1");
  });

  it("denies a PR role from downloading an out-of-scope request file", async () => {
    mockPrisma.prAttachment.findFirst.mockResolvedValue(attachmentFor("dept-2"));

    await expect(downloadFile(scopedPr, "file-1")).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
    expect(readFromStorage).not.toHaveBeenCalled();
  });

  it("does not reveal files linked to another organization", async () => {
    mockPrisma.prAttachment.findFirst.mockResolvedValue({
      request: {
        organizationId: "org-2",
        departmentId: "dept-2",
        requesterId: "owner-2",
      },
      task: null,
    });

    await expect(downloadFile(scopedPr, "file-1")).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
    expect(readFromStorage).not.toHaveBeenCalled();
  });

  it("allows a requester to download their own file outside a PR grant scope", async () => {
    mockPrisma.prAttachment.findFirst.mockResolvedValue(attachmentFor("dept-2", "pr-1"));

    await expect(downloadFile(scopedPr, "file-1")).resolves.toMatchObject({
      fileName: "brief.pdf",
    });
    expect(readFromStorage).toHaveBeenCalledOnce();
  });

  it("keeps the out-of-scope check when an attachment links to multiple requests", async () => {
    mockPrisma.prAttachment.findFirst.mockResolvedValue({
      request: attachmentFor("dept-1").request,
      task: { request: attachmentFor("dept-2").request },
    });

    await expect(downloadFile(scopedPr, "file-1")).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
    expect(readFromStorage).not.toHaveBeenCalled();
  });
});
