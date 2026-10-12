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
  role: "RTRDA_PR",
  roleGrants: [
    { role: "RTRDA_ALL_USER", departmentId: null },
    { role: "RTRDA_PR", departmentId: "dept-1" },
  ],
};

const attachmentFor = (
  departmentId: string,
  requesterId = "owner-1",
  hasAllUserRole = true,
) => ({
  request: {
    organizationId: "org-1",
    departmentId,
    requesterId,
    requester: { roles: hasAllUserRole ? [{ id: "all-user-role" }] : [] },
  },
  task: null,
});

const board: PrCenterActor = {
  id: "board-1",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "RTRDA_BORD",
  roleGrants: [{ role: "RTRDA_BORD", departmentId: "dept-1" }],
};

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
        requester: { roles: [{ id: "all-user-role" }] },
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

  it("allows BORD to download an ALL_USER request attachment in its scoped department", async () => {
    mockPrisma.prAttachment.findFirst.mockResolvedValue(attachmentFor("dept-1"));

    await expect(downloadFile(board, "file-1")).resolves.toMatchObject({
      fileName: "brief.pdf",
    });
    expect(readFromStorage).toHaveBeenCalledOnce();
  });

  it("allows BORD to download any in-scope request attachment like PR", async () => {
    mockPrisma.prAttachment.findFirst.mockResolvedValue(
      attachmentFor("dept-1", "owner-2", false),
    );

    await expect(downloadFile(board, "file-1")).resolves.toMatchObject({
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
