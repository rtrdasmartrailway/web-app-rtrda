import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, tx } = vi.hoisted(() => {
  const tx = {
    prTaskRevision: { updateMany: vi.fn() },
    prAuditEvent: { create: vi.fn() },
  };
  const prisma = {
    prTask: { findFirst: vi.fn() },
    prFileObject: { findFirst: vi.fn() },
    prAttachment: { findFirst: vi.fn() },
    ...tx,
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  return { prisma, tx };
});

vi.mock("@/lib/db/client", () => ({ prisma }));

import { assignFinalAsset } from "./service";

const actor = {
  id: "pr-user",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "PR_OPERATIONS" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation((callback) => callback(tx));
  prisma.prTask.findFirst.mockResolvedValue({
    id: "task-1",
    version: 4,
    revisions: [{ revisionNumber: 2 }],
  });
  prisma.prFileObject.findFirst.mockResolvedValue({ id: "file-1" });
  prisma.prAttachment.findFirst.mockResolvedValue({ id: "attachment-1" });
  tx.prTaskRevision.updateMany.mockResolvedValue({ count: 1 });
  tx.prAuditEvent.create.mockResolvedValue({});
});

describe("final asset assignment", () => {
  it("requires a clean file to be attached to the task", async () => {
    prisma.prAttachment.findFirst.mockResolvedValueOnce(null);
    await expect(
      assignFinalAsset(actor, "task-1", 4, { fileId: "file-1" }),
    ).rejects.toMatchObject({ code: "FINAL_ASSET_NOT_ATTACHED", statusCode: 422 });
    expect(tx.prTaskRevision.updateMany).not.toHaveBeenCalled();
  });

  it("assigns an attached clean file to the current revision", async () => {
    await expect(
      assignFinalAsset(actor, "task-1", 4, { fileId: "file-1" }),
    ).resolves.toMatchObject({ taskId: "task-1", revisionNumber: 2, fileId: "file-1" });
    expect(prisma.prAttachment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ taskId: "task-1", fileId: "file-1" }),
      }),
    );
    expect(tx.prTaskRevision.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { taskId: "task-1", revisionNumber: 2 },
        data: { finalAssetId: "file-1" },
      }),
    );
  });
});
