import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, tx, store, remove, scan, read } = vi.hoisted(() => {
  const tx = {
    prRequest: { updateMany: vi.fn() },
    prTask: { updateMany: vi.fn() },
    prFileObject: { create: vi.fn() },
    prAttachment: { findFirst: vi.fn(), create: vi.fn() },
    prAuditEvent: { create: vi.fn() },
    $executeRaw: vi.fn(),
  };
  return {
    tx,
    prisma: {
      prRequest: { findFirst: vi.fn() },
      prTask: { findFirst: vi.fn() },
      prFileObject: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
      prAttachment: { findMany: vi.fn() },
      $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    },
    store: vi.fn(),
    remove: vi.fn(),
    scan: vi.fn(),
    read: vi.fn(),
  };
});
vi.mock("@/lib/db/client", () => ({ prisma }));
vi.mock("./file-storage", () => ({
  storeFile: store,
  removeFileFromStorage: remove,
  readFileFromStorage: read,
  FileValidationError: class extends Error {},
}));
vi.mock("./clamav-scanner", () => ({ scanWithClamAv: scan, isClamAvAvailable: vi.fn() }));
import {
  uploadFile,
  createAttachment,
  downloadFile,
  assignFinalAsset,
  listAttachments,
  listQuarantinedFiles,
  type PrCenterActor,
} from "./service";

const requestId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const actor: PrCenterActor = {
  id: "user",
  organizationId: "org",
  departmentId: "dept",
  role: "RTRDA_PR",
  roleGrants: [{ role: "RTRDA_PR", departmentId: "dept" }],
};
const request = {
  id: requestId,
  organizationId: "org",
  departmentId: "dept",
  requesterId: "other",
  version: 3,
  status: "DRAFT",
};
const file = {
  id: "file",
  organizationId: "org",
  storageKey: "private/key",
  checksum: "secret",
  fileName: "a.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1,
  scanStatus: "CLEAN",
  scannedAt: new Date(),
  createdAt: new Date(),
  deletedAt: null,
};
const bytes = {
  fileName: "a.pdf",
  mimeType: "application/pdf",
  content: Buffer.from("a"),
};
const targeted = { ...bytes, requestId, kind: "SOURCE" };

beforeEach(() => {
  vi.resetAllMocks();
  prisma.$transaction.mockImplementation(async (fn) => fn(tx));
  prisma.prRequest.findFirst.mockResolvedValue(request);
  prisma.prTask.findFirst.mockResolvedValue({
    id: taskId,
    requestId,
    request,
    version: 4,
    status: "DRAFT",
  });
  tx.prRequest.updateMany.mockResolvedValue({ count: 1 });
  tx.prTask.updateMany.mockResolvedValue({ count: 1 });
  store.mockResolvedValue({ ...file, absolutePath: "/private/key" });
  remove.mockResolvedValue(true);
  scan.mockResolvedValue({ status: "CLEAN" });
  tx.prFileObject.create.mockImplementation(async ({ data }) => ({ ...file, ...data }));
  tx.prAttachment.findFirst.mockResolvedValue(null);
  tx.prAttachment.create.mockImplementation(async ({ data }) => ({
    id: "link",
    ...data,
    file,
  }));
  prisma.prFileObject.findFirst.mockResolvedValue(file);
});

// Small relational predicate model: exercise the generated scope against rows,
// rather than making list mocks return whatever the test wants to see.
function matches(row: unknown, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === "AND")
      return (value as Record<string, unknown>[]).every((w) => matches(row, w));
    if (key === "OR")
      return (value as Record<string, unknown>[])
        .filter((w) => Object.keys(w).length > 0)
        .some((w) => matches(row, w));
    if (key === "is")
      return value === null
        ? row == null
        : row != null && matches(row, value as Record<string, unknown>);
    if (key === "isNot")
      return value === null
        ? row != null
        : !matches(row, value as Record<string, unknown>);
    if (key === "some")
      return (row as unknown[]).some((r) => matches(r, value as Record<string, unknown>));
    if (key === "every")
      return (row as unknown[]).every((r) =>
        matches(r, value as Record<string, unknown>),
      );
    if (key === "in") return (value as unknown[]).includes(row);
    const actual = (row as Record<string, unknown> | null)?.[key];
    return value !== null && typeof value === "object"
      ? matches(actual, value as Record<string, unknown>)
      : actual === value;
  });
}

describe("upload-time target binding", () => {
  it.each(["request", "task"])(
    "makes nonclean %s uploads visible only to matching department PR",
    async (target) => {
      scan.mockResolvedValueOnce({ status: "QUARANTINED" });
      const result = await uploadFile(actor, {
        ...bytes,
        ...(target === "request" ? { requestId } : { taskId }),
        kind: "SOURCE",
      });
      const link = tx.prAttachment.create.mock.calls[0][0].data;
      const row = {
        ...file,
        ...result,
        attachments: [
          {
            ...link,
            request: link.requestId ? request : null,
            task: link.taskId ? { request } : null,
          },
        ],
      };
      prisma.prFileObject.findMany.mockImplementation(async ({ where }) =>
        matches(row, where) ? [result] : [],
      );
      prisma.prFileObject.count.mockImplementation(async ({ where }) =>
        matches(row, where) ? 1 : 0,
      );
      expect(await listQuarantinedFiles(actor)).toMatchObject([{ id: "file" }]);
      const elsewhere: PrCenterActor = {
        ...actor,
        roleGrants: [{ role: "RTRDA_PR", departmentId: "elsewhere" }],
      };
      expect(await listQuarantinedFiles(elsewhere)).toEqual([]);
      expect(
        await listQuarantinedFiles({ ...actor, organizationId: "elsewhere" }),
      ).toEqual([]);
    },
  );
  it("permits requester ownership without converting it into department PR authority", async () => {
    const requester: PrCenterActor = {
      ...actor,
      role: "RTRDA_ALL_USER",
      roleGrants: [{ role: "RTRDA_ALL_USER", departmentId: null }],
    };
    prisma.prRequest.findFirst.mockImplementationOnce(async ({ where }) =>
      matches({ ...request, requesterId: actor.id, departmentId: "other-dept" }, where)
        ? { ...request, requesterId: actor.id, departmentId: "other-dept" }
        : null,
    );
    await uploadFile(requester, targeted);
    expect(tx.prAttachment.create).toHaveBeenCalledOnce();
    await expect(listQuarantinedFiles(requester)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("reports cleanup failure explicitly instead of claiming orphan-free failure", async () => {
    tx.prRequest.updateMany.mockResolvedValueOnce({ count: 0 });
    remove.mockResolvedValueOnce(false);
    await expect(uploadFile(actor, targeted)).rejects.toMatchObject({
      code: "UPLOAD_CLEANUP_FAILED",
    });
  });
  it.each(["CLEAN", "QUARANTINED", "FAILED"])(
    "atomically binds %s and returns no storage secrets",
    async (status) => {
      if (status === "FAILED") scan.mockRejectedValueOnce(new Error("scanner offline"));
      else scan.mockResolvedValueOnce({ status });
      const result = await uploadFile(actor, targeted);
      expect(result).toMatchObject({ id: "file", scanStatus: status });
      expect(result).not.toHaveProperty("storageKey");
      expect(result).not.toHaveProperty("checksum");
      expect(tx.prAttachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { fileId: "file", requestId, taskId: null, kind: "SOURCE", version: 1 },
        }),
      );
      expect(tx.prRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: requestId,
            organizationId: "org",
            departmentId: "dept",
            requesterId: "other",
            version: 3,
            status: "DRAFT",
          }),
        }),
      );
      expect(remove).not.toHaveBeenCalled();
    },
  );
  it("binds a task only after locking its scoped request and task snapshot", async () => {
    await uploadFile(actor, { ...bytes, taskId, kind: "FINAL" });
    expect(prisma.prTask.findFirst).toHaveBeenCalledWith({
      where: {
        id: taskId,
        request: {
          organizationId: "org",
          OR: [{ requesterId: "user" }, { departmentId: "dept" }],
        },
      },
      include: { request: true },
    });
    expect(tx.prTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: taskId,
          requestId,
          version: 4,
          status: "DRAFT",
        }),
      }),
    );
    expect(tx.prAttachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requestId: null, taskId }),
      }),
    );
  });
  it.each([
    { requestId, taskId, kind: "SOURCE" },
    { requestId: "bad id", kind: "SOURCE" },
    { requestId: "", kind: "SOURCE" },
    { requestId: null, kind: "SOURCE" },
    { requestId, kind: "" },
    { requestId, kind: 2 },
    { requestId },
    { kind: "SOURCE" },
  ])("rejects malformed/conflicting target before storage: %j", async (target) => {
    await expect(
      uploadFile(actor, { ...bytes, ...target } as never),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(store).not.toHaveBeenCalled();
    expect(scan).not.toHaveBeenCalled();
  });
  it.each([
    { label: "wrong department", row: { ...request, departmentId: "elsewhere" } },
    { label: "cross organization", row: { ...request, organizationId: "elsewhere" } },
    { label: "missing target", row: null },
  ])("fails closed before storage for $label", async ({ row }) => {
    prisma.prRequest.findFirst.mockImplementationOnce(async ({ where }) =>
      row &&
      row.organizationId === where.organizationId &&
      where.OR.some((clause: Record<string, string>) =>
        Object.entries(clause).every(
          ([key, value]) => row[key as keyof typeof row] === value,
        ),
      )
        ? row
        : null,
    );
    await expect(uploadFile(actor, targeted)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(prisma.prRequest.findFirst).toHaveBeenCalledWith({
      where: {
        id: requestId,
        organizationId: "org",
        OR: [{ requesterId: "user" }, { departmentId: "dept" }],
      },
    });
    expect(store).not.toHaveBeenCalled();
  });
  it.each([
    { label: "department", change: { departmentId: "elsewhere" } },
    { label: "organization", change: { organizationId: "elsewhere" } },
    { label: "ownership", change: { requesterId: "replacement" } },
    { label: "version", change: { version: 4 } },
    { label: "state", change: { status: "CANCELLED" } },
  ])(
    "cleans stored bytes and rolls back when request $label moves during scan",
    async ({ change }) => {
      scan.mockImplementationOnce(async () => {
        const moved = { ...request, ...change };
        tx.prRequest.updateMany.mockImplementationOnce(async ({ where }) => ({
          count: Object.entries(moved).every(([key, value]) => where[key] === value)
            ? 1
            : 0,
        }));
        return { status: "QUARANTINED" };
      });
      await expect(uploadFile(actor, targeted)).rejects.toMatchObject({
        code: "STALE_UPDATE",
      });
      expect(tx.prFileObject.create).not.toHaveBeenCalled();
      expect(tx.prAttachment.create).not.toHaveBeenCalled();
      expect(remove).toHaveBeenCalledWith("org", "private/key");
    },
  );
  it("cleans bytes if the task moved to another request during scanning", async () => {
    tx.prTask.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      uploadFile(actor, { ...bytes, taskId, kind: "SOURCE" }),
    ).rejects.toMatchObject({ code: "STALE_UPDATE" });
    expect(tx.prFileObject.create).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledOnce();
  });
  it("cleans bytes on attachment transaction failure", async () => {
    tx.prAttachment.create.mockRejectedValueOnce(new Error("database error"));
    await expect(uploadFile(actor, targeted)).rejects.toThrow("database error");
    expect(remove).toHaveBeenCalledOnce();
  });
  it("allows a CLEAN exact-link replay, with a safe nested file", async () => {
    await uploadFile(actor, targeted);
    tx.prAttachment.findFirst.mockResolvedValueOnce({
      id: "link",
      fileId: "file",
      requestId,
      taskId: null,
      kind: "SOURCE",
      version: 1,
      file,
    });
    const result = await createAttachment(actor, {
      fileId: "file",
      requestId,
      kind: "SOURCE",
    });
    expect(result.file).not.toHaveProperty("storageKey");
    expect(result.file).not.toHaveProperty("checksum");
    expect(tx.prAttachment.create).toHaveBeenCalledOnce();
  });
  it.each(["QUARANTINED", "FAILED", "PENDING"])(
    "does not relax download or attachment replay for %s",
    async (status) => {
      prisma.prFileObject.findFirst.mockResolvedValueOnce({
        ...file,
        scanStatus: status,
      });
      await expect(downloadFile(actor, "file")).rejects.toMatchObject({
        code: "FILE_NOT_AVAILABLE",
      });
      prisma.prFileObject.findFirst.mockResolvedValueOnce(null);
      await expect(
        createAttachment(actor, { fileId: "file", requestId, kind: "SOURCE" }),
      ).rejects.toMatchObject({ code: "FILE_NOT_FOUND" });
      expect(read).not.toHaveBeenCalled();
      expect(tx.prAttachment.create).not.toHaveBeenCalled();
      prisma.prFileObject.findFirst.mockImplementationOnce(async ({ where }) =>
        where.scanStatus === status ? { ...file, scanStatus: status } : null,
      );
      await expect(
        assignFinalAsset(actor, taskId, 4, { fileId: "file" }),
      ).rejects.toMatchObject({ code: "FILE_NOT_FOUND" });
    },
  );
  it("returns safe nested files on creation and listing", async () => {
    const created = await createAttachment(actor, {
      fileId: "file",
      requestId,
      kind: "SOURCE",
    });
    expect(created.file).not.toHaveProperty("checksum");
    expect(created.file).not.toHaveProperty("storageKey");
    prisma.prAttachment.findMany.mockResolvedValueOnce([created]);
    await listAttachments(actor, { requestId });
    const selection = prisma.prAttachment.findMany.mock.calls[0][0].include.file.select;
    expect(selection).not.toHaveProperty("checksum");
    expect(selection).not.toHaveProperty("storageKey");
    expect(selection).toMatchObject({ deletedAt: true, scannedAt: true });
  });
  it("keeps legacy uploads unbound, with departmental quarantine requiring existing scoped links", async () => {
    await uploadFile(actor, bytes);
    expect(tx.prAttachment.create).not.toHaveBeenCalled();
    const legacy = { ...file, scanStatus: "QUARANTINED", attachments: [] };
    prisma.prFileObject.findMany.mockImplementation(async ({ where }) =>
      matches(legacy, where) ? [legacy] : [],
    );
    expect(await listQuarantinedFiles(actor)).toEqual([]);
    expect(prisma.prFileObject.findMany.mock.calls[0][0].where).toMatchObject({
      attachments: { some: expect.any(Object), every: expect.any(Object) },
    });
    expect(
      await listQuarantinedFiles({
        ...actor,
        roleGrants: [{ role: "RTRDA_PR", departmentId: null }],
      }),
    ).toEqual([legacy]);
  });
});
