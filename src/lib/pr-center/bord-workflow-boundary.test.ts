import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => {
  const db = {
    prRequest: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    prTask: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    prOrganizationSetting: { findUnique: vi.fn() },
    prRequestRevision: { create: vi.fn() },
    prRequestSource: { deleteMany: vi.fn(), createMany: vi.fn() },
    prApproval: { findFirst: vi.fn(), create: vi.fn() },
    prTaskFactCheck: { findFirst: vi.fn() },
    prFileObject: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      findFirstOrThrow: vi.fn(),
    },
    prAttachment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
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
  downloadFile,
  listApprovalQueue,
  recordApprovalDecision,
  restoreRequest,
  updateRequestDraft,
  transitionRequest,
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
      return (Array.isArray(value) ? value : [value])
        .filter((v) => v && typeof v === "object" && Object.keys(v).length > 0)
        .some((v) => accepts(row, v));
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
  id: "bord-reviewer",
  organizationId: "org-1",
  departmentId: "dept-a",
  role: "RTRDA_BORD",
  roleGrants: [
    { role: "RTRDA_BORD", departmentId: "dept-a" },
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
  vi.stubEnv("PR_CENTER_APPROVAL_POLICY_JSON", JSON.stringify(policy));
  db.prApproval.findFirst.mockResolvedValue(null);
  db.prApproval.create.mockResolvedValue({ id: "approval-1" });
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

describe("BORD workflow boundary acceptance", () => {
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

  it("cannot assign an own request task outside the BORD grant", async () => {
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

  it("cannot transition an own request task outside the BORD grant", async () => {
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

  it("does not let ownership substitute for a BORD grant when removing attachments", async () => {
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
      roleGrants: [{ role: "RTRDA_BORD" as const, departmentId: null }],
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

// Synthetic owner-policy fixture. Keep technical and management conditions separate.
const policy = {
  version: "bord-audit-v1",
  approvalReference: "SYNTHETIC-POLICY",
  effectiveAt: "2026-01-01T00:00:00Z",
  stages: [
    {
      status: "SOURCE_FACT_CHECK",
      required: true,
      roles: ["RTRDA_PR"],
      departmentScope: "TASK_DEPARTMENT",
    },
    {
      status: "TECHNICAL_REVIEW",
      required: true,
      roles: ["RTRDA_PR", "RTRDA_BORD"],
      departmentScope: "TASK_DEPARTMENT",
      condition: "TECHNICAL_REVIEW_REQUIRED",
    },
    {
      status: "PR_EDITORIAL_REVIEW",
      required: true,
      roles: ["RTRDA_PR"],
      departmentScope: "TASK_DEPARTMENT",
    },
    {
      status: "MANAGEMENT_APPROVAL",
      required: true,
      roles: ["RTRDA_BORD"],
      departmentScope: "TASK_DEPARTMENT",
      condition: "MANAGEMENT_APPROVAL_REQUIRED",
    },
  ],
};
afterEach(() => vi.unstubAllEnvs());
function stageTask(status = "TECHNICAL_REVIEW", extra = {}) {
  return {
    ...task,
    status,
    technicalReviewRequired: true,
    managementApprovalRequired: true,
    revisions: [{ revisionNumber: 3 }],
    ...extra,
  };
}
function scopedTask(row: ReturnType<typeof stageTask>) {
  db.prTask.findFirst.mockImplementation((q) =>
    Promise.resolve(accepts(row, q.where) ? project(row, q) : null),
  );
}
const idea = () => ({
  id: "idea-1",
  organizationId: "org-1",
  departmentId: "dept-a",
  proposerId: "someone-else",
  status: "PENDING_APPROVAL",
  version: 2,
  title: "Synthetic idea",
});

describe("BORD independent stage policies", () => {
  it.each(["TECHNICAL_REVIEW", "MANAGEMENT_APPROVAL"])(
    "permits scoped BORD %s and pins stage/revision/policy",
    async (status) => {
      scopedTask(stageTask(status));
      await expect(
        recordApprovalDecision(actor, task.id, 2, { decision: "APPROVED" }),
      ).resolves.toEqual({ id: "approval-1" });
      const { where, data } = db.prTask.updateMany.mock.calls[0][0];
      expect(data.status).toBe(
        status === "TECHNICAL_REVIEW" ? "PR_EDITORIAL_REVIEW" : "APPROVED",
      );
      expect(db.prApproval.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          stage: status,
          taskRevision: 3,
          approvalPolicyVersion: policy.version,
        }),
      });
      expect(accepts(stageTask(status), where)).toBe(true);
      expect(
        accepts(
          stageTask(status, { request: { ...task.request, departmentId: "dept-b" } }),
          where,
        ),
      ).toBe(false);
      expect(accepts(stageTask(status, { version: 3 }), where)).toBe(false);
      expect(accepts(stageTask("CANCELLED"), where)).toBe(false);
    },
  );
  it.each(["SOURCE_FACT_CHECK", "PR_EDITORIAL_REVIEW"])(
    "denies BORD alone at %s",
    async (status) => {
      scopedTask(stageTask(status));
      await expect(
        recordApprovalDecision(actor, task.id, 2, { decision: "APPROVED" }),
      ).rejects.toMatchObject({ code: "APPROVAL_AUTHORITY_MISMATCH" });
      expect(db.prTask.updateMany).not.toHaveBeenCalled();
    },
  );
  it.each(["owner", "requester"])("denies self %s stage decisions", async (self) => {
    scopedTask(
      stageTask(
        "TECHNICAL_REVIEW",
        self === "owner"
          ? { ownerId: actor.id }
          : { request: { ...task.request, requesterId: actor.id } },
      ),
    );
    await expect(
      recordApprovalDecision(actor, task.id, 2, {
        decision: "REJECTED",
        comment: "Reason",
      }),
    ).rejects.toMatchObject({ code: "SELF_APPROVAL_BLOCKED" });
    expect(db.prTask.updateMany).not.toHaveBeenCalled();
  });
  it.each(["TECHNICAL_REVIEW", "MANAGEMENT_APPROVAL"])(
    "uses its own independent flag at %s",
    async (status) => {
      scopedTask(
        stageTask(
          status,
          status === "TECHNICAL_REVIEW"
            ? { technicalReviewRequired: false, managementApprovalRequired: true }
            : { technicalReviewRequired: true, managementApprovalRequired: false },
        ),
      );
      await expect(
        recordApprovalDecision(actor, task.id, 2, { decision: "APPROVED" }),
      ).rejects.toMatchObject({ code: "APPROVAL_STAGE_NOT_CONFIGURED" });
    },
  );
  it("global PR cannot widen scoped BORD management authority", async () => {
    const mixed: PrCenterActor = {
      ...actor,
      roleGrants: [...actor.roleGrants!, { role: "RTRDA_PR", departmentId: null }],
    };
    scopedTask(
      stageTask("MANAGEMENT_APPROVAL", {
        request: { ...task.request, departmentId: "dept-b" },
      }),
    );
    await expect(
      recordApprovalDecision(mixed, task.id, 2, { decision: "APPROVED" }),
    ).rejects.toMatchObject({ code: "APPROVAL_AUTHORITY_MISMATCH" });
  });
  it("global BORD cannot widen scoped PR editorial authority", async () => {
    const mixed: PrCenterActor = {
      ...actor,
      roleGrants: [
        { role: "RTRDA_BORD", departmentId: null },
        { role: "RTRDA_PR", departmentId: "dept-b" },
      ],
    };
    scopedTask(stageTask("PR_EDITORIAL_REVIEW"));
    await expect(
      recordApprovalDecision(mixed, task.id, 2, { decision: "APPROVED" }),
    ).rejects.toMatchObject({ code: "APPROVAL_AUTHORITY_MISMATCH" });
  });
  it("mixed in-scope PR permits editorial only with separate checklist", async () => {
    const mixed: PrCenterActor = {
      ...actor,
      roleGrants: [...actor.roleGrants!, { role: "RTRDA_PR", departmentId: "dept-a" }],
    };
    scopedTask(stageTask("PR_EDITORIAL_REVIEW"));
    await expect(
      recordApprovalDecision(mixed, task.id, 2, {
        decision: "APPROVED",
        reviewChecklist: {
          message: true,
          language: true,
          format: true,
          appropriateness: true,
        },
      }),
    ).resolves.toEqual({ id: "approval-1" });
  });
  it("organization policy rejects department-only BORD", async () => {
    vi.stubEnv(
      "PR_CENTER_APPROVAL_POLICY_JSON",
      JSON.stringify({
        ...policy,
        stages: policy.stages.map((s) =>
          s.status === "MANAGEMENT_APPROVAL"
            ? { ...s, departmentScope: "ORGANIZATION" }
            : s,
        ),
      }),
    );
    scopedTask(stageTask("MANAGEMENT_APPROVAL"));
    await expect(
      recordApprovalDecision(actor, task.id, 2, { decision: "APPROVED" }),
    ).rejects.toMatchObject({ code: "APPROVAL_AUTHORITY_MISMATCH" });
  });
  it.each(["TECHNICAL_REVIEW", "MANAGEMENT_APPROVAL"])(
    "loses %s write race without approval/audit/history",
    async (status) => {
      scopedTask(stageTask(status));
      db.prTask.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        recordApprovalDecision(actor, task.id, 2, { decision: "APPROVED" }),
      ).rejects.toMatchObject({ code: "STALE_UPDATE" });
      expect(db.prApproval.create).not.toHaveBeenCalled();
      expect(db.prStatusHistory.create).not.toHaveBeenCalled();
      expect(db.prAuditEvent.create).not.toHaveBeenCalled();
    },
  );
  it("queue excludes editorial, disabled stages, self and outside departments", async () => {
    const rows = [
      stageTask(),
      stageTask("MANAGEMENT_APPROVAL"),
      stageTask("PR_EDITORIAL_REVIEW"),
      stageTask("TECHNICAL_REVIEW", { technicalReviewRequired: false }),
      stageTask("MANAGEMENT_APPROVAL", { managementApprovalRequired: false }),
      stageTask("TECHNICAL_REVIEW", { ownerId: actor.id }),
      stageTask("TECHNICAL_REVIEW", {
        request: { ...task.request, departmentId: "dept-b" },
      }),
    ];
    db.prTask.findMany.mockImplementation((q) =>
      Promise.resolve(rows.filter((row) => accepts(row, q.where))),
    );
    expect((await listApprovalQueue(actor)).map((row) => row.status)).toEqual([
      "TECHNICAL_REVIEW",
      "MANAGEMENT_APPROVAL",
    ]);
  });
  it("BORD may not change PR-only conditional requirement flags", async () => {
    scopedTask(stageTask("COMMUNICATION_PLANNING"));
    await expect(
      updateTaskAssignment(actor, task.id, 2, {
        ownerId: null,
        dueAt: null,
        technicalReviewRequired: false,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.prTask.updateMany).not.toHaveBeenCalled();
  });
  it("does not bypass stage approvals using task transitions", async () => {
    scopedTask(stageTask());
    await expect(
      transitionTask(actor, task.id, 2, "PR_EDITORIAL_REVIEW", undefined),
    ).rejects.toMatchObject({ code: "APPROVAL_STAGE_BYPASS_BLOCKED" });
    expect(db.prTask.updateMany).not.toHaveBeenCalled();
  });
});
describe("BORD restore and idea scope", () => {
  it.each(["WITHDRAWN", "CANCELLED"])(
    "restores %s with eligible scope/version",
    async (status) => {
      const row = { ...request, status };
      db.prRequest.findFirst.mockImplementation((q) =>
        Promise.resolve(accepts(row, q.where) ? row : null),
      );
      await restoreRequest(actor, request.id, 2, "Review reason");
      const { where } = db.prRequest.updateMany.mock.calls[0][0];
      expect(accepts(row, where)).toBe(true);
      expect(accepts({ ...row, departmentId: "dept-b" }, where)).toBe(false);
      expect(accepts({ ...row, organizationId: "org-2" }, where)).toBe(false);
      expect(accepts({ ...row, version: 3 }, where)).toBe(false);
    },
  );
  it("global PR and ownership do not widen BORD restore", async () => {
    const mixed: PrCenterActor = {
      ...actor,
      roleGrants: [...actor.roleGrants!, { role: "RTRDA_PR", departmentId: null }],
    };
    const row = {
      ...request,
      status: "WITHDRAWN",
      departmentId: "dept-b",
      requesterId: actor.id,
    };
    db.prRequest.findFirst.mockImplementation((q) =>
      Promise.resolve(accepts(row, q.where) ? row : null),
    );
    await expect(restoreRequest(mixed, request.id, 2, undefined)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.prRequest.updateMany).not.toHaveBeenCalled();
  });
  it("restore lost race emits no audit/history", async () => {
    db.prRequest.findFirst.mockResolvedValue({ ...request, status: "WITHDRAWN" });
    db.prRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(restoreRequest(actor, request.id, 2, undefined)).rejects.toMatchObject({
      code: "STALE_UPDATE",
    });
    expect(db.prStatusHistory.create).not.toHaveBeenCalled();
    expect(db.prAuditEvent.create).not.toHaveBeenCalled();
  });
  it("reviews nonself in-scope idea with scoped version write", async () => {
    db.prContentIdea.findFirst.mockResolvedValue(idea());
    await transitionIdea(actor, "idea-1", 2, "ACCEPTED", "Reviewed");
    const { where } = db.prContentIdea.updateMany.mock.calls[0][0];
    expect(accepts(idea(), where)).toBe(true);
    expect(accepts({ ...idea(), departmentId: "dept-b" }, where)).toBe(false);
    expect(accepts({ ...idea(), version: 3 }, where)).toBe(false);
  });
  it("idea lost race emits no notifications or audit", async () => {
    db.prContentIdea.findFirst.mockResolvedValue(idea());
    db.prContentIdea.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      transitionIdea(actor, "idea-1", 2, "ACCEPTED", "Reviewed"),
    ).rejects.toMatchObject({ code: "STALE_UPDATE" });
    expect(db.prNotification.createMany).not.toHaveBeenCalled();
    expect(db.prAuditEvent.create).not.toHaveBeenCalled();
  });
});
// Policy reconciliation: no documented idea self-decision prohibition exists.
// Request intake and Message House have separate, explicit separation rules.
describe("AUDIT BUG expected boundary regressions", () => {
  it.each(["ACCEPTED", "REJECTED", "REVISION_REQUIRED"] as const)(
    "preserves existing scoped BORD self idea %s policy",
    async (to) => {
      db.prContentIdea.findFirst.mockResolvedValue({ ...idea(), proposerId: actor.id });
      await expect(
        transitionIdea(actor, "idea-1", 2, to, "Reason"),
      ).resolves.toMatchObject({ id: "idea-1" });
      expect(db.prContentIdea.updateMany).toHaveBeenCalledOnce();
      expect(db.prNotification.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ userId: actor.id, target: "idea:idea-1" })],
      });
    },
  );
  it("restore conditional write pins terminal status", async () => {
    const row = { ...request, status: "WITHDRAWN" };
    db.prRequest.findFirst.mockResolvedValue(row);
    await restoreRequest(actor, request.id, 2, undefined);
    expect(
      accepts(
        { ...row, status: "APPROVED" },
        db.prRequest.updateMany.mock.calls[0][0].where,
      ),
    ).toBe(false);
  });
  it("idea conditional write pins prior stage", async () => {
    db.prContentIdea.findFirst.mockResolvedValue(idea());
    await transitionIdea(actor, "idea-1", 2, "ACCEPTED", "Reviewed");
    expect(
      accepts(
        { ...idea(), status: "ARCHIVED" },
        db.prContentIdea.updateMany.mock.calls[0][0].where,
      ),
    ).toBe(false);
  });
  it.each(["assignment", "transition"])(
    "%s conditional write repeats parent lifecycle guard",
    async (operation) => {
      if (operation === "assignment")
        await updateTaskAssignment(actor, task.id, 2, { ownerId: null, dueAt: null });
      else await transitionTask(actor, task.id, 2, "IN_PRODUCTION", undefined);
      expect(
        accepts(
          { ...task, request: { ...task.request, status: "CANCELLED" } },
          db.prTask.updateMany.mock.calls[0][0].where,
        ),
      ).toBe(false);
    },
  );
  it("shared file download checks every link rather than first attachment", async () => {
    const file = {
      id: "file-1",
      organizationId: "org-1",
      deletedAt: null,
      scanStatus: "CLEAN",
      storageKey: "synthetic",
      fileName: "fixture.pdf",
      mimeType: "application/pdf",
    };
    const links = [attachmentFixture(), attachmentFixture("dept-b")];
    db.prFileObject.findFirst.mockResolvedValue(file);
    db.prAttachment.findMany.mockImplementation((q) =>
      Promise.resolve(
        links.filter((row) => accepts(row, q.where)).map((row) => project(row, q)),
      ),
    );
    await expect(downloadFile(actor, file.id)).rejects.toMatchObject({ statusCode: 403 });
    expect(readFileFromStorage).not.toHaveBeenCalled();
  });
});

// State-bearing mock: all service calls use real generated predicates against
// current rows, and writes advance version/status. No database/network access.
describe("BORD restore -> owner amendment/resubmission -> intake", () => {
  const owner: PrCenterActor = {
    ...actor,
    id: "requester-1",
    role: "RTRDA_ALL_USER",
    roleGrants: [{ role: "RTRDA_ALL_USER", departmentId: "dept-a" }],
  };
  const details = {
    projectOwner: "Owner",
    assigner: "Director",
    confirmed: true,
    whyNow: "Research results ready",
    contentTypes: ["Website News"],
    priorityReason: "",
    projectDetails: "",
  };
  const input = {
    type: "PR" as const,
    title: "Restored research update",
    requestedFor: new Date("2026-11-20"),
    sourceUrls: ["https://example.org/brief"],
    objective: "Inform passengers",
    audience: "Passengers",
    requestDetails: details,
  };
  function stateFixture() {
    const row = {
      ...request,
      status: "WITHDRAWN",
      type: "PR",
      requestedFor: input.requestedFor,
      priority: "NORMAL",
      priorityReason: null,
      sources: [{ url: input.sourceUrls[0] }],
      revisions: [
        {
          revisionNumber: 2,
          title: input.title,
          objective: input.objective,
          audience: input.audience,
          offsiteDetails: details,
        },
      ],
      tasks: [
        {
          id: "old-task",
          requestId: request.id,
          status: "CANCELLED",
          version: 2,
          contentType: "Website News",
          title: "Website News: Restored research update",
          dueAt: input.requestedFor,
        },
      ],
    };
    db.prOrganizationSetting.findUnique.mockResolvedValue(null);
    db.prRequest.findFirst.mockImplementation((q) =>
      Promise.resolve(accepts(row, q.where) ? structuredClone(row) : null),
    );
    db.prRequest.updateMany.mockImplementation((q) => {
      if (!accepts(row, q.where)) return Promise.resolve({ count: 0 });
      if (q.data.status) row.status = q.data.status;
      row.version += q.data.version?.increment ?? 0;
      return Promise.resolve({ count: 1 });
    });
    db.prRequest.findUniqueOrThrow.mockImplementation(() =>
      Promise.resolve(structuredClone(row)),
    );
    db.prRequestRevision.create.mockImplementation((q) => {
      row.revisions.unshift({ ...q.data });
      return Promise.resolve(q.data);
    });
    db.prTask.updateMany.mockImplementation((q) => {
      const child = row.tasks.find((t) => accepts(t, q.where));
      if (!child) return Promise.resolve({ count: 0 });
      if (q.data.status) child.status = q.data.status;
      if (q.data.title) child.title = q.data.title;
      child.version += q.data.version?.increment ?? 0;
      return Promise.resolve({ count: 1 });
    });
    db.prTask.create.mockImplementation((q) => {
      const child = { ...q.data, id: "new-task", status: "DRAFT", version: 1 };
      row.tasks.push(child);
      return Promise.resolve(child);
    });
    db.prUserRole.findMany.mockResolvedValue([{ userId: actor.id }]);
    return row;
  }
  it("restoration does not let BORD edit or submit someone else's draft", async () => {
    const row = stateFixture();
    await restoreRequest(actor, row.id, 2, "Scoped restore");
    expect(row.status).toBe("DRAFT");
    expect(row.tasks[0].status).toBe("CANCELLED");
    await expect(updateRequestDraft(actor, row.id, 3, input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(transitionRequest(actor, row.id, 3, "SUBMITTED")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("owner edits same content type, reopens cancelled task, resubmits and BORD accepts", async () => {
    const row = stateFixture();
    await restoreRequest(actor, row.id, 2, "Scoped restore");
    await updateRequestDraft(owner, row.id, 3, input);
    expect(row.tasks[0].status).toBe("DRAFT");
    await transitionRequest(owner, row.id, 4, "SUBMITTED");
    await expect(
      recordRequestDecision(actor, row.id, 5, { decision: "APPROVED" }),
    ).resolves.toMatchObject({ status: "APPROVED" });
  });
  it("AUDIT BUG restored request may resubmit without amendment and still reach intake", async () => {
    const row = stateFixture();
    await restoreRequest(actor, row.id, 2, "Scoped restore");
    await transitionRequest(owner, row.id, 3, "SUBMITTED");
    expect(row.tasks.map((t) => t.status)).toEqual(["CANCELLED", "DRAFT"]);
    await expect(
      recordRequestDecision(actor, row.id, 4, { decision: "APPROVED" }),
    ).resolves.toMatchObject({ status: "APPROVED" });
  });
  it("AUDIT BUG changing content type preserves cancelled history without blocking intake", async () => {
    const row = stateFixture();
    await restoreRequest(actor, row.id, 2, "Scoped restore");
    await updateRequestDraft(owner, row.id, 3, {
      ...input,
      requestDetails: { ...details, contentTypes: ["Press Release"] },
    });
    expect(row.tasks.map((t) => t.status)).toEqual(["CANCELLED", "DRAFT"]);
    await transitionRequest(owner, row.id, 4, "SUBMITTED");
    await expect(
      recordRequestDecision(actor, row.id, 5, { decision: "APPROVED" }),
    ).resolves.toMatchObject({ status: "APPROVED" });
  });
});

describe("historical cancelled intake tasks", () => {
  const historical = { id: "historical", status: "CANCELLED", version: 7 };
  const active = { id: "active", status: "DRAFT", version: 1 };
  it("does not mark cancelled history as started work in the scoped intake queue", async () => {
    db.prRequest.findMany.mockResolvedValue([
      { ...request, tasks: [historical, active] },
    ]);
    const rows = await listRequestApprovalQueue(actor);
    expect(rows[0].intakeDecisionBlockedReason).toBeNull();
  });
  it("rejects only the current draft tasks and retains cancelled history unchanged", async () => {
    db.prRequest.findFirst.mockResolvedValue({ ...request, tasks: [historical, active] });
    await recordRequestDecision(actor, request.id, 2, {
      decision: "REJECTED",
      reason: "Needs revision",
    });
    expect(db.prTask.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { id: "active", status: "DRAFT", version: 1 },
      data: { status: "CANCELLED", version: { increment: 1 } },
    });
    expect(db.prStatusHistory.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ taskId: "historical" }),
      }),
    );
  });
});

describe("task parent lifecycle repeated at mutation", () => {
  it.each(["assignment", "transition"])(
    "%s draft write requires the parent to remain APPROVED",
    async (operation) => {
      const draft = { ...task, status: "DRAFT" };
      db.prTask.findFirst.mockResolvedValue(draft);
      if (operation === "assignment")
        await updateTaskAssignment(actor, task.id, 2, { ownerId: null, dueAt: null });
      else await transitionTask(actor, task.id, 2, "COMMUNICATION_PLANNING", undefined);
      const where = db.prTask.updateMany.mock.calls[0][0].where;
      expect(accepts(draft, where)).toBe(true);
      for (const status of ["DRAFT", "SUBMITTED", "REJECTED", "CANCELLED", "WITHDRAWN"]) {
        expect(accepts({ ...draft, request: { ...draft.request, status } }, where)).toBe(
          false,
        );
      }
      expect(
        accepts(
          { ...draft, request: { ...draft.request, departmentId: "dept-b" } },
          where,
        ),
      ).toBe(false);
    },
  );
  it.each(["assignment", "transition"])(
    "lost %s parent lifecycle race has no downstream effects",
    async (operation) => {
      db.prTask.updateMany.mockImplementation(({ where }) =>
        Promise.resolve({
          count: accepts(
            { ...task, request: { ...task.request, status: "REJECTED" } },
            where,
          )
            ? 1
            : 0,
        }),
      );
      const action =
        operation === "assignment"
          ? updateTaskAssignment(actor, task.id, 2, { ownerId: null, dueAt: null })
          : transitionTask(actor, task.id, 2, "IN_PRODUCTION", undefined);
      await expect(action).rejects.toMatchObject({
        code: "STALE_UPDATE",
        statusCode: 409,
      });
      expect(db.prAuditEvent.create).not.toHaveBeenCalled();
      expect(db.prOutboxEvent.create).not.toHaveBeenCalled();
      expect(db.prStatusHistory.create).not.toHaveBeenCalled();
      expect(db.prTask.findUniqueOrThrow).not.toHaveBeenCalled();
    },
  );
});
