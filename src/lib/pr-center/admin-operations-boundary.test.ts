import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => {
  const db = {
    prRequest: {
      create: vi.fn(),
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
  createRequest,
  requestDetail,
  listContentLibraryRequests,
  moveBoardTask,
  updateRequestDraft,
  transitionRequest,
  listQuarantinedFiles,
  listRequestApprovalQueue,
  recordRequestDecision,
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

const actor: PrCenterActor = {
  id: "admin-1",
  organizationId: "org-1",
  departmentId: "dept-home",
  role: "RTRDA_ADMIN",
  roleGrants: [
    { role: "RTRDA_ADMIN", departmentId: "dept-a" },
    { role: "RTRDA_ALL_USER", departmentId: null },
  ],
};
const request = {
  id: "request-1",
  organizationId: "org-1",
  departmentId: "dept-a",
  requesterId: "requester-1",
  title: "Boundary fixture",
  type: "PR" as const,
  status: "DRAFT",
  version: 2,
  priority: "NORMAL",
  requestedFor: null,
  tasks: [],
  revisions: [{ revisionNumber: 1 }],
  sources: [],
  attachments: [],
  statusHistory: [],
  requester: { roles: [] },
};
const input = { title: "Amended request", type: "PR" as const, sourceUrls: [] };
const task = {
  id: "task-1",
  requestId: request.id,
  ownerId: "writer-1",
  title: "Task fixture",
  status: "COMMUNICATION_PLANNING",
  version: 2,
  technicalReviewRequired: true,
  managementApprovalRequired: true,
  request: { ...request, status: "APPROVED" },
  revisions: [{ revisionNumber: 3 }],
};
function mockRequest(row: Record<string, unknown> = request) {
  db.prRequest.findFirst.mockImplementation((q) =>
    Promise.resolve(accepts(row, q.where) ? project(row, q) : null),
  );
  db.prRequest.findUniqueOrThrow.mockResolvedValue(row);
}
function mockTask(row = task) {
  db.prTask.findFirst.mockImplementation((q) =>
    Promise.resolve(accepts(row, q.where) ? project(row, q) : null),
  );
  db.prTask.findUniqueOrThrow.mockResolvedValue(row);
}
function mixed(role: "RTRDA_PR" | "RTRDA_BORD"): PrCenterActor {
  return { ...actor, roleGrants: [...actor.roleGrants!, { role, departmentId: null }] };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("PR_CENTER_APPROVAL_POLICY_JSON", JSON.stringify(policy));
  db.$transaction.mockImplementation((callback) => callback(db));
  mockRequest();
  mockTask();
  db.prOrganizationSetting.findUnique.mockResolvedValue(null);
  db.prRequest.updateMany.mockResolvedValue({ count: 1 });
  db.prTask.updateMany.mockResolvedValue({ count: 1 });
  db.prUserRole.findMany.mockResolvedValue([]);
  db.prApproval.findFirst.mockResolvedValue(null);
  db.prApproval.create.mockResolvedValue({ id: "approval-1" });
  db.prContentIdea.updateMany.mockResolvedValue({ count: 1 });
  db.prContentIdea.findUniqueOrThrow.mockResolvedValue({ id: "idea-1" });
});
afterEach(() => vi.unstubAllEnvs());

describe("ADMIN request amendment and lifecycle boundary", () => {
  it.each(["DRAFT", "SUBMITTED", "WITHDRAWN", "REJECTED"])(
    "amends another request in ADMIN scope at %s without widening lifecycle",
    async (status) => {
      mockRequest({ ...request, status });
      await updateRequestDraft(actor, request.id, 2, input);
      const { where, data } = db.prRequest.updateMany.mock.calls[0][0];
      expect(data.version).toEqual({ increment: 1 });
      expect(accepts({ ...request, status }, where)).toBe(true);
      expect(accepts({ ...request, status, departmentId: "dept-b" }, where)).toBe(false);
      expect(accepts({ ...request, status, organizationId: "org-2" }, where)).toBe(false);
      expect(accepts({ ...request, status, version: 3 }, where)).toBe(false);
      expect(accepts({ ...request, status: "APPROVED" }, where)).toBe(false);
    },
  );
  it.each(["APPROVED", "CLOSED", "CANCELLED"])(
    "does not permit admin amendment at %s",
    async (status) => {
      mockRequest({ ...request, status });
      await expect(updateRequestDraft(actor, request.id, 2, input)).rejects.toMatchObject(
        { code: "INVALID_TRANSITION" },
      );
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );
  it.each(["RTRDA_PR", "RTRDA_BORD"] as const)(
    "global %s cannot lend its scope to an ADMIN request amendment",
    async (role) => {
      mockRequest({ ...request, departmentId: "dept-b" });
      await expect(
        updateRequestDraft(mixed(role), request.id, 2, input),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );
  it.each(["RTRDA_PR", "RTRDA_BORD"] as const)(
    "global %s cannot lend its scope to an ADMIN withdrawal",
    async (role) => {
      mockRequest({ ...request, departmentId: "dept-b" });
      await expect(
        transitionRequest(mixed(role), request.id, 2, "WITHDRAWN"),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );
  it.each(["DRAFT", "SUBMITTED", "WITHDRAWN", "REJECTED"])(
    "preserves requester own %s amendments outside all elevated scopes",
    async (status) => {
      const own = { ...request, status, requesterId: actor.id, departmentId: "dept-b" };
      mockRequest(own);
      await updateRequestDraft(actor, request.id, 2, input);
      const { where } = db.prRequest.updateMany.mock.calls[0][0];
      expect(accepts(own, where)).toBe(true);
      expect(accepts({ ...own, requesterId: "new-requester" }, where)).toBe(false);
      expect(accepts({ ...own, organizationId: "org-2" }, where)).toBe(false);
    },
  );
  it("fails closed on amendment scope transfer before write", async () => {
    db.prRequest.updateMany.mockImplementation(({ where }) =>
      Promise.resolve({
        count: accepts({ ...request, departmentId: "dept-b" }, where) ? 1 : 0,
      }),
    );
    await expect(updateRequestDraft(actor, request.id, 2, input)).rejects.toMatchObject({
      code: "STALE_UPDATE",
    });
    expect(db.prRequestRevision.create).not.toHaveBeenCalled();
    expect(db.prStatusHistory.create).not.toHaveBeenCalled();
    expect(db.prAuditEvent.create).not.toHaveBeenCalled();
  });
  it.each(["SUBMITTED", "WITHDRAWN"] as const)(
    "editing authority does not permit nonowned %s",
    async (status) => {
      await expect(transitionRequest(actor, request.id, 2, status)).rejects.toMatchObject(
        { code: "FORBIDDEN" },
      );
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );
  it("pins lifecycle, organization and ownership in requester withdrawal writes", async () => {
    const own = { ...request, requesterId: actor.id, departmentId: "dept-b" };
    mockRequest(own);
    await transitionRequest(actor, request.id, 2, "WITHDRAWN");
    const { where } = db.prRequest.updateMany.mock.calls[0][0];
    expect(accepts(own, where)).toBe(true);
    expect(accepts({ ...own, status: "APPROVED" }, where)).toBe(false);
    expect(accepts({ ...own, version: 3 }, where)).toBe(false);
    expect(accepts({ ...own, requesterId: "new-requester" }, where)).toBe(false);
    expect(accepts({ ...own, organizationId: "org-2" }, where)).toBe(false);
  });
  it("creates a personal draft using home department, not elevated grant scope", async () => {
    db.prRequest.create.mockResolvedValue(request);
    await createRequest(actor, input);
    expect(db.prRequest.create.mock.calls[0][0].data).toMatchObject({
      requesterId: actor.id,
      departmentId: actor.departmentId,
      organizationId: actor.organizationId,
    });
  });
  it("records admin authorship without changing requester/department and tells the requester to resubmit", async () => {
    mockRequest({ ...request, status: "SUBMITTED" });
    await updateRequestDraft(actor, request.id, 2, input);
    const { data } = db.prRequest.updateMany.mock.calls[0][0];
    expect(data).not.toHaveProperty("requesterId");
    expect(data).not.toHaveProperty("departmentId");
    expect(db.prRequestRevision.create.mock.calls[0][0].data.changeSummary).toBe(
      "Administrator amendment",
    );
    expect(db.prStatusHistory.create.mock.calls[0][0].data.reason).toContain(
      "Administrator amended",
    );
    expect(db.prNotification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: request.requesterId,
          body: expect.stringContaining("administrator"),
        }),
      ],
    });
  });
  it("does not amend when package task work started", async () => {
    mockRequest({
      ...request,
      tasks: [{ ...task, status: "IN_PRODUCTION" }],
    });
    await expect(updateRequestDraft(actor, request.id, 2, input)).rejects.toMatchObject({
      code: "REQUEST_WORK_ALREADY_STARTED",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("ADMIN operational reads, intake, restore and tasks", () => {
  it("does not read an unrelated department by ID", async () => {
    mockRequest({ ...request, departmentId: "dept-b" });
    await expect(requestDetail(actor, request.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
  it("library cannot borrow ownership outside operational scope", async () => {
    const outside = { ...request, requesterId: actor.id, departmentId: "dept-b" };
    db.prRequest.findMany.mockImplementation(({ where }) =>
      Promise.resolve([request, outside].filter((r) => accepts(r, where))),
    );
    await expect(listContentLibraryRequests(actor)).resolves.toHaveLength(1);
  });
  it.each(["APPROVED", "REJECTED"] as const)(
    "permits in-scope admin intake %s",
    async (decision) => {
      mockRequest({ ...request, status: "SUBMITTED" });
      await recordRequestDecision(actor, request.id, 2, {
        decision,
        reason: "Rationale",
      });
      const { where } = db.prRequest.updateMany.mock.calls[0][0];
      expect(accepts({ ...request, status: "SUBMITTED" }, where)).toBe(true);
      expect(
        accepts({ ...request, status: "SUBMITTED", departmentId: "dept-b" }, where),
      ).toBe(false);
    },
  );
  it("cannot use ownership for out-of-scope intake", async () => {
    mockRequest({
      ...request,
      departmentId: "dept-b",
      requesterId: actor.id,
      status: "SUBMITTED",
    });
    await expect(
      recordRequestDecision(actor, request.id, 2, { decision: "APPROVED" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.prRequest.updateMany).not.toHaveBeenCalled();
  });
  it("cannot self-approve in-scope intake", async () => {
    mockRequest({ ...request, requesterId: actor.id, status: "SUBMITTED" });
    await expect(
      recordRequestDecision(actor, request.id, 2, { decision: "APPROVED" }),
    ).rejects.toMatchObject({ code: "SELF_APPROVAL_BLOCKED" });
  });
  it.each(["WITHDRAWN", "CANCELLED"])(
    "restores in-scope %s with conditional scope",
    async (status) => {
      mockRequest({ ...request, status });
      await restoreRequest(actor, request.id, 2, "Restore rationale");
      const { where } = db.prRequest.updateMany.mock.calls[0][0];
      expect(accepts({ ...request, status }, where)).toBe(true);
      expect(accepts({ ...request, status, departmentId: "dept-b" }, where)).toBe(false);
      expect(accepts({ ...request, status, version: 3 }, where)).toBe(false);
    },
  );
  it("global PR cannot widen ADMIN restore", async () => {
    mockRequest({
      ...request,
      status: "WITHDRAWN",
      departmentId: "dept-b",
      requesterId: actor.id,
    });
    await expect(
      restoreRequest(mixed("RTRDA_PR"), request.id, 2, "Restore"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it.each(["assign", "transition"])(
    "permits ADMIN %s task only in grant scope",
    async (operation) => {
      if (operation === "assign")
        await updateTaskAssignment(actor, task.id, 2, { ownerId: null, dueAt: null });
      else await transitionTask(actor, task.id, 2, "IN_PRODUCTION", undefined);
      const { where } = db.prTask.updateMany.mock.calls[0][0];
      expect(accepts(task, where)).toBe(true);
      expect(
        accepts(
          {
            ...task,
            request: { ...task.request, departmentId: "dept-b", requesterId: actor.id },
          },
          where,
        ),
      ).toBe(false);
      expect(accepts({ ...task, version: 3 }, where)).toBe(false);
    },
  );
  it("ADMIN alone cannot configure PR-only approval requirements", async () => {
    await expect(
      updateTaskAssignment(actor, task.id, 2, {
        ownerId: null,
        dueAt: null,
        technicalReviewRequired: false,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.prTask.updateMany).not.toHaveBeenCalled();
  });
  it("ADMIN alone cannot use PR-only free-board route", async () => {
    await expect(
      moveBoardTask(actor, task.id, 2, { column: "In production" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.prTask.findFirst).not.toHaveBeenCalled();
  });
});

describe("ADMIN stage decisions use actual stage grant", () => {
  it.each([
    "SOURCE_FACT_CHECK",
    "TECHNICAL_REVIEW",
    "PR_EDITORIAL_REVIEW",
    "MANAGEMENT_APPROVAL",
  ])("ADMIN alone cannot decide %s", async (status) => {
    mockTask({ ...task, status });
    await expect(
      recordApprovalDecision(actor, task.id, 2, { decision: "APPROVED" }),
    ).rejects.toMatchObject({ code: "APPROVAL_AUTHORITY_MISMATCH" });
    expect(db.prApproval.create).not.toHaveBeenCalled();
  });
  it.each(["RTRDA_PR", "RTRDA_BORD"] as const)(
    "global ADMIN cannot widen scoped %s stage grant",
    async (role) => {
      const reviewer: PrCenterActor = {
        ...actor,
        roleGrants: [
          { role: "RTRDA_ADMIN", departmentId: null },
          { role, departmentId: "dept-b" },
        ],
      };
      mockTask({
        ...task,
        status: role === "RTRDA_PR" ? "PR_EDITORIAL_REVIEW" : "MANAGEMENT_APPROVAL",
      });
      await expect(
        recordApprovalDecision(reviewer, task.id, 2, { decision: "APPROVED" }),
      ).rejects.toMatchObject({ code: "APPROVAL_AUTHORITY_MISMATCH" });
      expect(db.prTask.updateMany).not.toHaveBeenCalled();
    },
  );
  it("ADMIN with an actual BORD grant may decide management stage", async () => {
    mockTask({ ...task, status: "MANAGEMENT_APPROVAL" });
    const reviewer: PrCenterActor = {
      ...actor,
      roleGrants: [...actor.roleGrants!, { role: "RTRDA_BORD", departmentId: "dept-a" }],
    };
    await expect(
      recordApprovalDecision(reviewer, task.id, 2, { decision: "APPROVED" }),
    ).resolves.toEqual({ id: "approval-1" });
  });
  it("ADMIN-only approval queue does not expose stages requiring other roles", async () => {
    db.prTask.findMany.mockResolvedValue(
      [
        "SOURCE_FACT_CHECK",
        "TECHNICAL_REVIEW",
        "PR_EDITORIAL_REVIEW",
        "MANAGEMENT_APPROVAL",
      ].map((status) => ({ ...task, status })),
    );
    await expect(listApprovalQueue(actor)).resolves.toEqual([]);
  });
});

describe("ADMIN race and file-operation regressions", () => {
  it("keeps intake queue in scope despite a global ALL_USER grant", async () => {
    const pending = { ...request, status: "SUBMITTED" };
    db.prRequest.findMany.mockImplementation((q) =>
      Promise.resolve(
        [pending, { ...pending, departmentId: "dept-b" }].filter((row) =>
          accepts(row, q.where),
        ),
      ),
    );
    await expect(listRequestApprovalQueue(actor)).resolves.toHaveLength(1);
  });
  it.each(["assign", "transition"])(
    "ownership does not lend ADMIN scope for task %s",
    async (operation) => {
      mockTask({
        ...task,
        ownerId: actor.id,
        request: { ...task.request, requesterId: actor.id, departmentId: "dept-b" },
      });
      await expect(
        operation === "assign"
          ? updateTaskAssignment(actor, task.id, 2, { ownerId: null, dueAt: null })
          : transitionTask(actor, task.id, 2, "IN_PRODUCTION", undefined),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(db.prTask.updateMany).not.toHaveBeenCalled();
    },
  );
  it.each(["assign", "transition"])(
    "does not audit a lost task %s scope race",
    async (operation) => {
      db.prTask.updateMany.mockImplementation(({ where }) =>
        Promise.resolve({
          count: accepts(
            { ...task, request: { ...task.request, departmentId: "dept-b" } },
            where,
          )
            ? 1
            : 0,
        }),
      );
      await expect(
        operation === "assign"
          ? updateTaskAssignment(actor, task.id, 2, { ownerId: null, dueAt: null })
          : transitionTask(actor, task.id, 2, "IN_PRODUCTION", undefined),
      ).rejects.toMatchObject({ code: "STALE_UPDATE" });
      expect(db.prStatusHistory.create).not.toHaveBeenCalled();
      expect(db.prAuditEvent.create).not.toHaveBeenCalled();
    },
  );
  it("cannot lend global ADMIN scope to scoped PR free-board moves", async () => {
    const reviewer: PrCenterActor = {
      ...actor,
      roleGrants: [
        { role: "RTRDA_ADMIN", departmentId: null },
        { role: "RTRDA_PR", departmentId: "dept-b" },
      ],
    };
    await expect(
      moveBoardTask(reviewer, task.id, 2, { column: "In production" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.prTask.updateMany).not.toHaveBeenCalled();
  });
  it.each(["restore", "intake"])(
    "does not audit a lost %s scope race",
    async (operation) => {
      const row = {
        ...request,
        status: operation === "restore" ? "WITHDRAWN" : "SUBMITTED",
      };
      mockRequest(row);
      db.prRequest.updateMany.mockImplementation(({ where }) =>
        Promise.resolve({
          count: accepts({ ...row, departmentId: "dept-b" }, where) ? 1 : 0,
        }),
      );
      await expect(
        operation === "restore"
          ? restoreRequest(actor, request.id, 2, "Restore")
          : recordRequestDecision(actor, request.id, 2, { decision: "APPROVED" }),
      ).rejects.toMatchObject({ code: "STALE_UPDATE" });
      expect(db.prStatusHistory.create).not.toHaveBeenCalled();
      expect(db.prAuditEvent.create).not.toHaveBeenCalled();
    },
  );
  it("ADMIN file download requires every linked target to be in scope", async () => {
    db.prFileObject.findFirst.mockResolvedValue({
      id: "file-1",
      organizationId: actor.organizationId,
      scanStatus: "CLEAN",
      deletedAt: null,
    });
    db.prAttachment.findMany.mockResolvedValue([
      { request, task: { request: { ...request, departmentId: "dept-b" } } },
    ]);
    await expect(downloadFile(actor, "file-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(readFileFromStorage).not.toHaveBeenCalled();
  });
  it("ADMIN cannot override a failed scan", async () => {
    const file = {
      id: "file-1",
      organizationId: "org-1",
      deletedAt: null,
      scanStatus: "FAILED",
      attachments: [{ request, task: null }],
    };
    db.prFileObject.findFirst.mockImplementation((q) =>
      Promise.resolve(accepts(file, q.where) ? project(file, q) : null),
    );
    await expect(
      reviewQuarantinedFile(actor, file.id, "approve", "Override"),
    ).rejects.toMatchObject({ code: "FILE_SCAN_REQUIRED" });
    expect(db.prFileObject.updateMany).not.toHaveBeenCalled();
  });
  it("rescans an in-scope file and repeats all-target and scan identity in write", async () => {
    const file = {
      id: "file-1",
      organizationId: "org-1",
      deletedAt: null,
      scannedAt: null,
      scanStatus: "FAILED",
      storageKey: "private-key",
      checksum: "fixture-checksum",
      attachments: [{ request, task: null }],
    };
    db.prFileObject.findFirst.mockImplementation((q) =>
      Promise.resolve(accepts(file, q.where) ? project(file, q) : null),
    );
    db.prFileObject.updateMany.mockResolvedValue({ count: 1 });
    db.prFileObject.findFirstOrThrow.mockResolvedValue({ id: file.id });
    vi.mocked(readFileFromStorage).mockResolvedValue(Buffer.from("fixture"));
    vi.mocked(scanWithClamAv).mockResolvedValue({ status: "CLEAN", signature: null });
    await rescanFile(actor, file.id);
    const { where } = db.prFileObject.updateMany.mock.calls[0][0];
    expect(accepts(file, where)).toBe(true);
    expect(
      accepts(
        {
          ...file,
          attachments: [{ request: { ...request, departmentId: "dept-b" }, task: null }],
        },
        where,
      ),
    ).toBe(false);
    expect(accepts({ ...file, scanStatus: "CLEAN" }, where)).toBe(false);
    expect(accepts({ ...file, checksum: "replaced" }, where)).toBe(false);
  });
});

describe("ADMIN ideas and all-target quarantine", () => {
  it("approves an in-scope idea and repeats scope in write", async () => {
    const idea = {
      id: "idea-1",
      organizationId: "org-1",
      departmentId: "dept-a",
      proposerId: actor.id,
      title: "Idea",
      status: "PENDING_APPROVAL",
      version: 2,
    };
    db.prContentIdea.findFirst.mockImplementation((q) =>
      Promise.resolve(accepts(idea, q.where) ? project(idea, q) : null),
    );
    await transitionIdea(actor, idea.id, 2, "ACCEPTED", "Rationale");
    const { where } = db.prContentIdea.updateMany.mock.calls[0][0];
    expect(accepts(idea, where)).toBe(true);
    expect(accepts({ ...idea, departmentId: "dept-b" }, where)).toBe(false);
  });
  it.each(["own", "other"])("cannot decide %s out-of-scope idea", async (kind) => {
    const idea = {
      id: "idea-1",
      organizationId: "org-1",
      departmentId: "dept-b",
      proposerId: kind === "own" ? actor.id : "someone",
      status: "PENDING_APPROVAL",
      version: 2,
    };
    db.prContentIdea.findFirst.mockImplementation((q) =>
      Promise.resolve(accepts(idea, q.where) ? project(idea, q) : null),
    );
    await expect(
      transitionIdea(actor, idea.id, 2, "ACCEPTED", "Rationale"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.prContentIdea.updateMany).not.toHaveBeenCalled();
  });
  it.each(["unlinked", "cross-department", "cross-org", "dual-target"])(
    "does not expose %s quarantined files",
    async (kind) => {
      const attachments =
        kind === "unlinked"
          ? []
          : [
              {
                request:
                  kind === "cross-department"
                    ? { ...request, departmentId: "dept-b" }
                    : kind === "cross-org"
                      ? { ...request, organizationId: "org-2" }
                      : request,
                task:
                  kind === "dual-target"
                    ? { request: { ...request, departmentId: "dept-b" } }
                    : null,
              },
            ];
      const file = {
        id: "file-1",
        organizationId: "org-1",
        scanStatus: "QUARANTINED",
        deletedAt: null,
        attachments,
      };
      db.prFileObject.findMany.mockImplementation((q) =>
        Promise.resolve(accepts(file, q.where) ? [project(file, q)] : []),
      );
      db.prFileObject.findFirst.mockImplementation((q) =>
        Promise.resolve(accepts(file, q.where) ? project(file, q) : null),
      );
      await expect(listQuarantinedFiles(actor)).resolves.toEqual([]);
      await expect(
        reviewQuarantinedFile(actor, file.id, "delete", "Reason"),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(rescanFile(actor, file.id)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(db.prFileObject.updateMany).not.toHaveBeenCalled();
      expect(readFileFromStorage).not.toHaveBeenCalled();
    },
  );
});
