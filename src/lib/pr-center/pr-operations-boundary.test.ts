import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => {
  const db = {
    prRequest: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    prTask: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    prFileObject: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      findFirstOrThrow: vi.fn(),
    },
    prAttachment: { findFirst: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    prContentIdea: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    prNotification: { createMany: vi.fn() },
    prStatusHistory: { create: vi.fn() },
    prAuditEvent: { create: vi.fn() },
    prOutboxEvent: { create: vi.fn() },
    prUserRole: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return { db };
});

vi.mock("@/lib/db/client", () => ({ prisma: db }));
vi.mock("./file-storage", () => ({ readFileFromStorage: vi.fn() }));
vi.mock("./clamav-scanner", () => ({
  scanWithClamAv: vi.fn(),
  isClamAvAvailable: vi.fn(),
}));
import { readFileFromStorage } from "./file-storage";
import { scanWithClamAv } from "./clamav-scanner";

import {
  listQuarantinedFiles,
  listRequestApprovalQueue,
  recordRequestDecision,
  removeAttachment,
  rescanFile,
  reviewQuarantinedFile,
  transitionIdea,
  transitionTask,
  updateTaskAssignment,
  type PrCenterActor,
} from "./service";

// Evaluate only the Prisma filter subset emitted by these service paths. Unlike
// an unconditional findFirst mock, this proves whether the actual scope admits
// each fixture. Unknown operators fail closed by normal structural matching.
function accepts(row: unknown, filter: unknown): boolean {
  if (filter && typeof filter === "object" && "in" in filter && Array.isArray(filter.in))
    return filter.in.includes(row);
  if (filter === null || typeof filter !== "object") return row === filter;
  if ("notIn" in filter && Array.isArray(filter.notIn))
    return !filter.notIn.includes(row);
  if ("is" in filter) return accepts(row, filter.is);
  if ("isNot" in filter) return !accepts(row, filter.isNot);
  if (!row || typeof row !== "object") return false;
  const record = row as Record<string, unknown>;
  return Object.entries(filter).every(([key, value]) => {
    if (key === "some") return Array.isArray(row) && row.some((v) => accepts(v, value));
    if (key === "every") return Array.isArray(row) && row.every((v) => accepts(v, value));
    if (key === "AND")
      return (Array.isArray(value) ? value : [value]).every((v) => accepts(row, v));
    if (key === "OR")
      return (Array.isArray(value) ? value : [value]).some((v) => accepts(row, v));
    if (key === "is") return accepts(row, value);
    return accepts(record[key], value);
  });
}

// Honor relation include/select, so a guard cannot accidentally read fields that
// Prisma did not fetch (the original removal path fetched organizationId only).
function project(row: Record<string, unknown>, query: Record<string, unknown>) {
  const selection = (query.select ?? query.include) as
    | Record<string, unknown>
    | undefined;
  if (!selection) return row;
  const result: Record<string, unknown> = query.select ? {} : { ...row };
  for (const [key, value] of Object.entries(selection)) {
    if (value === true) result[key] = row[key];
    else if (value && typeof value === "object") {
      const relation = row[key];
      const relationQuery = value as Record<string, unknown>;
      result[key] = Array.isArray(relation)
        ? relation
            .filter((item) => !relationQuery.where || accepts(item, relationQuery.where))
            .map((item) => project(item as Record<string, unknown>, relationQuery))
        : relation && typeof relation === "object"
          ? project(relation as Record<string, unknown>, relationQuery)
          : relation;
    }
  }
  return result;
}

function attachmentFixture(departmentId = "dept-a", taskDepartmentId?: string) {
  return {
    id: "attachment-1",
    fileId: "file-1",
    kind: "evidence",
    version: 1,
    requestId: request.id,
    taskId: taskDepartmentId ? "task-1" : null,
    request: { ...request, departmentId },
    task: taskDepartmentId
      ? { request: { ...request, departmentId: taskDepartmentId } }
      : null,
  };
}

function mockAttachment(row: ReturnType<typeof attachmentFixture>) {
  db.prAttachment.findFirst.mockImplementation((query) =>
    Promise.resolve(accepts(row, query.where) ? project(row, query) : null),
  );
}

const actor: PrCenterActor = {
  id: "pr-reviewer",
  organizationId: "org-1",
  departmentId: "dept-a",
  role: "RTRDA_PR",
  roleGrants: [
    { role: "RTRDA_PR", departmentId: "dept-a" },
    { role: "RTRDA_ALL_USER", departmentId: null },
  ],
};
const request = {
  id: "request-1",
  organizationId: "org-1",
  departmentId: "dept-a",
  requesterId: "requester-1",
  title: "Boundary fixture",
  status: "SUBMITTED",
  version: 2,
  tasks: [],
  requester: { roles: [{ id: "requester-grant" }] },
};
const task = {
  id: "task-1",
  requestId: request.id,
  ownerId: "writer-1",
  status: "COMMUNICATION_PLANNING",
  version: 2,
  request: { ...request, status: "APPROVED" },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readFileFromStorage).mockResolvedValue(Buffer.from("scan fixture"));
  vi.mocked(scanWithClamAv).mockResolvedValue({ status: "CLEAN", signature: null });
  db.$transaction.mockImplementation((callback) => callback(db));
  db.prRequest.findFirst.mockResolvedValue(request);
  db.prRequest.findMany.mockResolvedValue([]);
  db.prRequest.updateMany.mockResolvedValue({ count: 1 });
  db.prRequest.findUniqueOrThrow.mockResolvedValue(request);
  db.prTask.findFirst.mockResolvedValue(task);
  db.prTask.updateMany.mockResolvedValue({ count: 1 });
  db.prTask.findUniqueOrThrow.mockResolvedValue(task);
  db.prUserRole.findMany.mockResolvedValue([]);
  db.prAttachment.count.mockResolvedValue(1);
  db.prAttachment.deleteMany.mockResolvedValue({ count: 1 });
  db.prFileObject.updateMany.mockResolvedValue({ count: 1 });
  db.prFileObject.findFirstOrThrow.mockResolvedValue({
    id: "file-1",
    deletedAt: new Date(),
  });
  db.prContentIdea.updateMany.mockResolvedValue({ count: 1 });
  db.prContentIdea.findUniqueOrThrow.mockResolvedValue({ id: "idea-1" });
});

describe("PR Operations boundary acceptance", () => {
  it("does not widen scoped intake reads through a global ALL_USER grant", async () => {
    await listRequestApprovalQueue(actor);
    const where = db.prRequest.findMany.mock.calls[0][0].where;
    expect(accepts(request, where)).toBe(true);
    expect(accepts({ ...request, departmentId: "dept-b" }, where)).toBe(false);
  });

  it.each(["APPROVED", "REJECTED"] as const)(
    "blocks self intake %s before any transaction",
    async (decision) => {
      db.prRequest.findFirst.mockResolvedValue({ ...request, requesterId: actor.id });
      await expect(
        recordRequestDecision(actor, request.id, 2, { decision, reason: "Reason" }),
      ).rejects.toMatchObject({ code: "SELF_APPROVAL_BLOCKED" });
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );

  it("requires a nonblank intake rejection reason", async () => {
    await expect(
      recordRequestDecision(actor, request.id, 2, { decision: "REJECTED", reason: " " }),
    ).rejects.toMatchObject({ code: "REASON_REQUIRED" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("cannot assign an own request task outside the PR grant", async () => {
    const outside = {
      ...task,
      request: { ...task.request, requesterId: actor.id, departmentId: "dept-b" },
    };
    db.prTask.findFirst.mockImplementation(({ where }) =>
      Promise.resolve(accepts(outside, where) ? outside : null),
    );
    await expect(
      updateTaskAssignment(actor, task.id, 2, { ownerId: null, dueAt: null }),
    ).rejects.toMatchObject({ statusCode: expect.any(Number) });
    expect(db.prTask.updateMany).not.toHaveBeenCalled();
  });

  it("cannot transition an own request task outside the PR grant", async () => {
    const outside = {
      ...task,
      request: { ...task.request, requesterId: actor.id, departmentId: "dept-b" },
    };
    db.prTask.findFirst.mockImplementation(({ where }) =>
      Promise.resolve(accepts(outside, where) ? outside : null),
    );
    await expect(
      transitionTask(actor, task.id, 2, "IN_PRODUCTION", undefined),
    ).rejects.toMatchObject({ statusCode: expect.any(Number) });
    expect(db.prTask.updateMany).not.toHaveBeenCalled();
  });

  it("cannot remove another department's attachment by ID", async () => {
    const outside = attachmentFixture("dept-b");
    mockAttachment(outside);
    await expect(removeAttachment(actor, outside.id)).rejects.toMatchObject({
      statusCode: expect.any(Number),
    });
    expect(db.prAttachment.deleteMany).not.toHaveBeenCalled();
  });

  it("denies cross-organization attachment removal without a write", async () => {
    const attachment = attachmentFixture();
    attachment.request.organizationId = "org-2";
    mockAttachment(attachment);
    await expect(removeAttachment(actor, attachment.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(db.prAttachment.deleteMany).not.toHaveBeenCalled();
  });

  it("removes a task-only in-scope attachment", async () => {
    const attachment = {
      ...attachmentFixture("dept-a", "dept-a"),
      requestId: null,
      request: null,
    };
    db.prAttachment.findFirst.mockImplementation((query) =>
      Promise.resolve(
        accepts(attachment, query.where) ? project(attachment, query) : null,
      ),
    );
    await expect(removeAttachment(actor, attachment.id)).resolves.toMatchObject({
      removed: true,
    });
  });

  it("soft-deletes an orphaned file only after in-scope attachment removal", async () => {
    const attachment = attachmentFixture();
    mockAttachment(attachment);
    db.prAttachment.count.mockResolvedValue(0);
    await expect(removeAttachment(actor, attachment.id)).resolves.toMatchObject({
      orphanedFileCleanedUp: true,
    });
    expect(db.prFileObject.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: attachment.fileId }),
        data: { deletedAt: expect.any(Date) },
      }),
    );
  });

  it("removes an in-scope attachment and keeps a still-linked file", async () => {
    const attachment = attachmentFixture();
    mockAttachment(attachment);
    await expect(removeAttachment(actor, attachment.id)).resolves.toMatchObject({
      id: attachment.id,
      removed: true,
      orphanedFileCleanedUp: false,
    });
    expect(db.prAttachment.deleteMany).toHaveBeenCalledOnce();
    expect(db.prFileObject.updateMany).not.toHaveBeenCalled();
  });

  it("cannot remove a dual-target attachment with one out-of-scope task", async () => {
    const attachment = attachmentFixture("dept-a", "dept-b");
    mockAttachment(attachment);
    await expect(removeAttachment(actor, attachment.id)).rejects.toMatchObject({
      statusCode: expect.any(Number),
    });
    expect(db.prAttachment.deleteMany).not.toHaveBeenCalled();
  });

  it("does not let ownership substitute for a PR grant when removing attachments", async () => {
    const attachment = attachmentFixture("dept-b");
    attachment.request.requesterId = actor.id;
    mockAttachment(attachment);
    await expect(removeAttachment(actor, attachment.id)).rejects.toMatchObject({
      statusCode: expect.any(Number),
    });
    expect(db.prAttachment.deleteMany).not.toHaveBeenCalled();
  });

  it("repeats authorized department scope in the attachment delete", async () => {
    const attachment = attachmentFixture();
    mockAttachment(attachment);
    await removeAttachment(actor, attachment.id);
    const where = db.prAttachment.deleteMany.mock.calls[0][0].where;
    expect(accepts(attachment, where)).toBe(true);
    expect(accepts(attachmentFixture("dept-b"), where)).toBe(false);
  });

  it("returns quarantine metadata without internal storage paths or checksum", async () => {
    const file = {
      id: "file-1",
      organizationId: "org-1",
      fileName: "evidence.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      scanStatus: "QUARANTINED",
      deletedAt: null,
      storageKey: "private/internal/path.pdf",
      checksum: "internal-content-hash",
      attachments: [{ request, task: null }],
    };
    db.prFileObject.findMany.mockImplementation((query) =>
      Promise.resolve(accepts(file, query.where) ? [project(file, query)] : []),
    );
    const result = await listQuarantinedFiles(actor);
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty("storageKey");
    expect(result[0]).not.toHaveProperty("checksum");
  });

  it("does not expose quarantine files when one attachment has an out-of-scope task", async () => {
    const file = {
      id: "file-1",
      organizationId: "org-1",
      scanStatus: "QUARANTINED",
      deletedAt: null,
      attachments: [
        {
          request,
          task: { request: { ...request, id: "request-2", departmentId: "dept-b" } },
        },
      ],
    };
    db.prFileObject.findMany.mockImplementation(({ where }) =>
      Promise.resolve(accepts(file, where) ? [file] : []),
    );
    await expect(listQuarantinedFiles(actor)).resolves.toEqual([]);
  });

  it("repeats intake authorization in the conditional write", async () => {
    await recordRequestDecision(actor, request.id, 2, { decision: "APPROVED" });
    const where = db.prRequest.updateMany.mock.calls[0][0].where;
    expect(accepts(request, where)).toBe(true);
    expect(accepts({ ...request, departmentId: "dept-b" }, where)).toBe(false);
  });

  it("repeats task authorization in the conditional write", async () => {
    await updateTaskAssignment(actor, task.id, 2, { ownerId: null, dueAt: null });
    const where = db.prTask.updateMany.mock.calls[0][0].where;
    expect(accepts(task, where)).toBe(true);
    expect(
      accepts({ ...task, request: { ...task.request, departmentId: "dept-b" } }, where),
    ).toBe(false);
  });

  it("repeats quarantine authorization and scan state in the delete write", async () => {
    const file = {
      id: "file-1",
      organizationId: "org-1",
      scanStatus: "QUARANTINED",
      deletedAt: null,
      attachments: [{ request, task: null }],
    };
    db.prFileObject.findFirst.mockResolvedValue(file);
    db.prFileObject.updateMany.mockResolvedValue({ count: 1 });
    await reviewQuarantinedFile(actor, file.id, "delete", "Unwanted upload");
    const where = db.prFileObject.updateMany.mock.calls[0][0].where;
    expect(accepts(file, where)).toBe(true);
    expect(accepts({ ...file, organizationId: "org-2" }, where)).toBe(false);
    expect(accepts({ ...file, scanStatus: "CLEAN" }, where)).toBe(false);
  });

  it("does not let unrelated global ALL_USER grants widen idea decisions", async () => {
    const outside = {
      id: "idea-1",
      organizationId: "org-1",
      departmentId: "dept-b",
      proposerId: "someone-else",
      status: "PENDING_APPROVAL",
      version: 2,
    };
    db.prContentIdea.findFirst.mockImplementation(({ where }) =>
      Promise.resolve(accepts(outside, where) ? outside : null),
    );
    await expect(
      transitionIdea(actor, outside.id, 2, "ACCEPTED", "Policy rationale"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.prContentIdea.updateMany).not.toHaveBeenCalled();
  });

  it("denies an attachment with neither target", async () => {
    const attachment = { ...attachmentFixture(), requestId: null, request: null };
    db.prAttachment.findFirst.mockImplementation((query) =>
      Promise.resolve(accepts(attachment, query.where) ? attachment : null),
    );
    await expect(removeAttachment(actor, attachment.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.prAttachment.deleteMany).not.toHaveBeenCalled();
  });

  it.each(["version", "fileId", "requestId", "taskId"] as const)(
    "pins attachment %s in the conditional delete",
    async (field) => {
      const attachment = attachmentFixture();
      mockAttachment(attachment);
      await removeAttachment(actor, attachment.id);
      const { where } = db.prAttachment.deleteMany.mock.calls[0][0];
      expect(accepts(attachment, where)).toBe(true);
      expect(
        accepts({ ...attachment, [field]: field === "version" ? 2 : "relinked" }, where),
      ).toBe(false);
    },
  );

  it("does not orphan-clean or audit after a lost attachment delete race", async () => {
    mockAttachment(attachmentFixture());
    db.prAttachment.deleteMany.mockResolvedValue({ count: 0 });
    await expect(removeAttachment(actor, "attachment-1")).rejects.toMatchObject({
      code: "STALE_UPDATE",
    });
    expect(db.prAttachment.count).not.toHaveBeenCalled();
    expect(db.prFileObject.updateMany).not.toHaveBeenCalled();
    expect(db.prAuditEvent.create).not.toHaveBeenCalled();
  });

  it.each(["assignment", "transition"] as const)(
    "fails closed on %s scope/version/status race without downstream effects",
    async (operation) => {
      const moved = { ...task, request: { ...task.request, departmentId: "dept-b" } };
      db.prTask.updateMany.mockImplementation(({ where }) =>
        Promise.resolve({ count: accepts(moved, where) ? 1 : 0 }),
      );
      const action =
        operation === "assignment"
          ? updateTaskAssignment(actor, task.id, 2, { ownerId: null, dueAt: null })
          : transitionTask(actor, task.id, 2, "IN_PRODUCTION", undefined);
      await expect(action).rejects.toMatchObject({ code: "STALE_UPDATE" });
      const { where } = db.prTask.updateMany.mock.calls[0][0];
      expect(accepts({ ...task, version: 3 }, where)).toBe(false);
      expect(accepts({ ...task, status: "CANCELLED" }, where)).toBe(false);
      expect(db.prAuditEvent.create).not.toHaveBeenCalled();
      expect(db.prStatusHistory.create).not.toHaveBeenCalled();
    },
  );

  it("fails closed when intake department moves before the decision write", async () => {
    db.prRequest.updateMany.mockImplementation(({ where }) =>
      Promise.resolve({
        count: accepts({ ...request, departmentId: "dept-b" }, where) ? 1 : 0,
      }),
    );
    await expect(
      recordRequestDecision(actor, request.id, 2, { decision: "APPROVED" }),
    ).rejects.toMatchObject({ code: "STALE_UPDATE" });
    expect(db.prStatusHistory.create).not.toHaveBeenCalled();
    expect(db.prAuditEvent.create).not.toHaveBeenCalled();
  });

  const quarantined = () => ({
    id: "file-1",
    organizationId: "org-1",
    scanStatus: "QUARANTINED",
    scannedAt: null,
    deletedAt: null,
    storageKey: "private/storage/key",
    checksum: "private-checksum",
    attachments: [{ request, task: null }],
  });

  it.each(["delete", "rescan"] as const)(
    "returns only safe metadata after quarantine %s",
    async (operation) => {
      const file = quarantined();
      db.prFileObject.findFirst.mockResolvedValue(file);
      db.prFileObject.findFirstOrThrow.mockImplementation((query) =>
        Promise.resolve(project(file, query)),
      );
      const result =
        operation === "delete"
          ? await reviewQuarantinedFile(actor, file.id, "delete", "Retention review")
          : await rescanFile(actor, file.id);
      expect(result).toHaveProperty("id", file.id);
      expect(result).not.toHaveProperty("storageKey");
      expect(result).not.toHaveProperty("checksum");
      const { where } = db.prFileObject.updateMany.mock.calls[0][0];
      expect(accepts(file, where)).toBe(true);
      expect(accepts({ ...file, organizationId: "org-2" }, where)).toBe(false);
      expect(accepts({ ...file, scanStatus: "CLEAN" }, where)).toBe(false);
      expect(accepts({ ...file, deletedAt: new Date() }, where)).toBe(false);
      expect(
        accepts(
          {
            ...file,
            attachments: [
              { request, task: { request: { ...request, departmentId: "dept-b" } } },
            ],
          },
          where,
        ),
      ).toBe(false);
    },
  );

  it.each(["delete", "rescan"] as const)(
    "does not audit or return success after a lost quarantine %s race",
    async (operation) => {
      const file = quarantined();
      db.prFileObject.findFirst.mockResolvedValue(file);
      db.prFileObject.updateMany.mockResolvedValue({ count: 0 });
      const action =
        operation === "delete"
          ? reviewQuarantinedFile(actor, file.id, "delete", "Retention review")
          : rescanFile(actor, file.id);
      await expect(action).rejects.toMatchObject({ code: "STALE_UPDATE" });
      expect(db.prAuditEvent.create).not.toHaveBeenCalled();
      expect(db.prFileObject.findFirstOrThrow).not.toHaveBeenCalled();
    },
  );

  it("denies out-of-scope rescan before reading private storage", async () => {
    const file = {
      ...quarantined(),
      attachments: [{ request: { ...request, departmentId: "dept-b" }, task: null }],
    };
    db.prFileObject.findFirst.mockImplementation(({ where }) =>
      Promise.resolve(accepts(file, where) ? file : null),
    );
    await expect(rescanFile(actor, file.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(readFileFromStorage).not.toHaveBeenCalled();
    expect(scanWithClamAv).not.toHaveBeenCalled();
    expect(db.prFileObject.updateMany).not.toHaveBeenCalled();
  });

  it("pins scan time and content identity when completing a rescan", async () => {
    const file = quarantined();
    db.prFileObject.findFirst.mockResolvedValue(file);
    await rescanFile(actor, file.id);
    const { where } = db.prFileObject.updateMany.mock.calls[0][0];
    for (const changed of [
      { scannedAt: new Date() },
      { storageKey: "replaced" },
      { checksum: "replaced" },
    ])
      expect(accepts({ ...file, ...changed }, where)).toBe(false);
  });

  it("supports capped quarantine pagination and the existing default call", async () => {
    await listQuarantinedFiles(actor);
    expect(db.prFileObject.findMany.mock.calls[0][0]).toMatchObject({
      take: 50,
      skip: 0,
    });
    await listQuarantinedFiles(actor, 500, 100);
    expect(db.prFileObject.findMany.mock.calls[1][0]).toMatchObject({
      take: 100,
      skip: 100,
    });
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid quarantine offset %s before querying",
    async (offset) => {
      await expect(listQuarantinedFiles(actor, 50, offset)).rejects.toMatchObject({
        code: "INVALID_PAGINATION",
      });
      expect(db.prFileObject.findMany).not.toHaveBeenCalled();
    },
  );

  it("keeps unlinked quarantine files hidden from department grants but available to eligible global grants", async () => {
    const file = { ...quarantined(), attachments: [] };
    db.prFileObject.findMany.mockImplementation(({ where }) =>
      Promise.resolve(accepts(file, where) ? [file] : []),
    );
    await expect(listQuarantinedFiles(actor)).resolves.toEqual([]);
    const global = {
      ...actor,
      roleGrants: [{ role: "RTRDA_PR" as const, departmentId: null }],
    };
    await expect(listQuarantinedFiles(global)).resolves.toHaveLength(1);
    const { where } = db.prFileObject.findMany.mock.calls[1][0];
    expect(
      accepts(
        {
          ...file,
          attachments: [{ request: { ...request, organizationId: "org-2" }, task: null }],
        },
        where,
      ),
    ).toBe(false);
  });

  it("does not claim orphan cleanup when the file gained another attachment before cleanup", async () => {
    mockAttachment(attachmentFixture());
    db.prAttachment.count.mockResolvedValue(0);
    db.prFileObject.updateMany.mockResolvedValue({ count: 0 });
    await expect(removeAttachment(actor, "attachment-1")).resolves.toMatchObject({
      removed: true,
      orphanedFileCleanedUp: false,
    });
    expect(db.prFileObject.updateMany).toHaveBeenCalledWith({
      where: {
        id: "file-1",
        organizationId: actor.organizationId,
        deletedAt: null,
        attachments: { none: {} },
      },
      data: { deletedAt: expect.any(Date) },
    });
    expect(db.prAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          after: expect.objectContaining({ orphanedFileCleanedUp: false }),
        }),
      }),
    );
  });
});
