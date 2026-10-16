import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, tx } = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    prAttachment: { findFirst: vi.fn(), create: vi.fn() },
    prAuditEvent: { create: vi.fn() },
  };
  return {
    tx,
    prisma: {
      prFileObject: { findFirst: vi.fn() },
      prRequest: { findFirst: vi.fn() },
      prTask: { findFirst: vi.fn() },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    },
  };
});

vi.mock("@/lib/db/client", () => ({ prisma }));

import { createAttachment, type PrCenterActor } from "./service";
import * as workflow from "./workflow";

type Link = {
  fileId: string;
  requestId: string | null;
  taskId: string | null;
  kind: string;
};
type Attachment = Link & { id: string; version: number; file: { id: string } };

const actor: PrCenterActor = {
  id: "requester-1",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "RTRDA_ALL_USER",
  roleGrants: [{ role: "RTRDA_ALL_USER", departmentId: null }],
};
const link: Link = {
  fileId: "file-1",
  requestId: "request-1",
  taskId: "task-1",
  kind: "SOURCE",
};
let rows: Attachment[];

function seed(values: Partial<Link> = {}): Attachment {
  const row = {
    ...link,
    ...values,
    id: `existing-${rows.length + 1}`,
    version: 7,
    file: { id: values.fileId ?? link.fileId },
  };
  rows.push(row);
  return row;
}

function input(values: Partial<Link> = {}) {
  const value = { ...link, ...values };
  return {
    ...value,
    requestId: value.requestId ?? undefined,
    taskId: value.taskId ?? undefined,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  rows = [];
  prisma.$transaction.mockImplementation((callback) => callback(tx));
  prisma.prFileObject.findFirst.mockResolvedValue({ id: "file-1", scanStatus: "CLEAN" });
  prisma.prRequest.findFirst.mockResolvedValue({ id: "request-1" });
  prisma.prTask.findFirst.mockResolvedValue({ id: "task-1" });
  // Model Prisma equality/null filters: an omitted predicate is NOT an IS NULL check.
  tx.prAttachment.findFirst.mockImplementation(async ({ where, select }) => {
    const matches = rows.filter((row) =>
      Object.entries(where).every(
        ([key, value]) => value === undefined || row[key as keyof Link] === value,
      ),
    );
    const row = matches.sort((a, b) => b.version - a.version)[0] ?? null;
    return row && select ? { version: row.version } : row;
  });
  tx.prAttachment.create.mockImplementation(async ({ data }) => {
    const row: Attachment = {
      ...data,
      id: `created-${rows.length + 1}`,
      file: { id: data.fileId },
    };
    rows.push(row);
    return row;
  });
  tx.prAuditEvent.create.mockResolvedValue({});
});

function expectNoLinkMutation() {
  expect(tx.prAttachment.create).not.toHaveBeenCalled();
  expect(tx.prAuditEvent.create).not.toHaveBeenCalled();
}

function expectNoLookupOrMutation() {
  expect(tx.prAttachment.findFirst).not.toHaveBeenCalled();
  expectNoLinkMutation();
}

describe("attachment linkage retries", () => {
  it.each([
    { label: "request only", requestId: "request-1", taskId: null },
    { label: "task only", requestId: null, taskId: "task-1" },
    { label: "request and task", requestId: "request-1", taskId: "task-1" },
  ])(
    "returns the existing $label link, including file, without another audit",
    async ({ requestId, taskId }) => {
      const target = { requestId, taskId };
      const existing = seed(target);

      await expect(createAttachment(actor, input(target))).resolves.toEqual(existing);

      expect(tx.prAttachment.findFirst).toHaveBeenCalledWith({
        where: {
          fileId: "file-1",
          requestId: target.requestId,
          taskId: target.taskId,
          kind: "SOURCE",
        },
        include: { file: true },
      });
      expect(rows).toHaveLength(1);
      expectNoLinkMutation();
    },
  );

  it("deduplicates a sequential retry after the first response was lost", async () => {
    const first = await createAttachment(actor, input(), "first-attempt");
    const retry = await createAttachment(actor, input(), "retry-attempt");

    expect(retry).toEqual(first);
    expect(rows).toHaveLength(1);
    expect(tx.prAttachment.create).toHaveBeenCalledOnce();
    expect(tx.prAuditEvent.create).toHaveBeenCalledOnce();
  });

  it("normalizes kind before checking for an existing link", async () => {
    const existing = seed();
    await expect(createAttachment(actor, input({ kind: "  SOURCE  " }))).resolves.toEqual(
      existing,
    );
    expectNoLinkMutation();
  });

  it("checks the current clean, undeleted, same-organization file before returning", async () => {
    seed();
    await createAttachment(actor, input());
    expect(prisma.prFileObject.findFirst).toHaveBeenCalledWith({
      where: {
        id: "file-1",
        organizationId: "org-1",
        scanStatus: "CLEAN",
        deletedAt: null,
      },
    });
    expect(prisma.prFileObject.findFirst.mock.invocationCallOrder[0]).toBeLessThan(
      tx.prAttachment.findFirst.mock.invocationCallOrder[0],
    );
  });

  it.each(["pending scan", "infected", "deleted", "another organization"])(
    "does not return an existing link when the file is unavailable: %s",
    async () => {
      seed();
      // A real database returns null for all these cases under the asserted predicate above.
      prisma.prFileObject.findFirst.mockResolvedValue(null);
      await expect(createAttachment(actor, input())).rejects.toMatchObject({
        statusCode: 404,
        code: "FILE_NOT_FOUND",
      });
      expectNoLookupOrMutation();
    },
  );

  it("rechecks role permission even when the link already exists", async () => {
    seed();
    // All current roles can attach; exercise the capability-denied guard explicitly.
    const permission = vi.spyOn(workflow, "canAttachFiles").mockReturnValueOnce(false);
    await expect(createAttachment(actor, input())).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
    permission.mockRestore();
    expectNoLookupOrMutation();
  });

  it.each(["request", "task"])(
    "rechecks %s scope before returning an existing link",
    async (target) => {
      seed();
      if (target === "request") prisma.prRequest.findFirst.mockResolvedValue(null);
      else prisma.prTask.findFirst.mockResolvedValue(null);
      await expect(createAttachment(actor, input())).rejects.toMatchObject({
        statusCode: 404,
        code: "NOT_FOUND",
      });
      expectNoLookupOrMutation();
    },
  );

  it("authorizes both targets with organization/ownership predicates before lookup", async () => {
    seed();
    await createAttachment(actor, input());
    const scope = { organizationId: "org-1", OR: [{ requesterId: actor.id }] };
    expect(prisma.prRequest.findFirst).toHaveBeenCalledWith({
      where: { id: "request-1", ...scope },
    });
    expect(prisma.prTask.findFirst).toHaveBeenCalledWith({
      where: { id: "task-1", request: scope },
    });
    for (const check of [prisma.prRequest.findFirst, prisma.prTask.findFirst]) {
      expect(check.mock.invocationCallOrder[0]).toBeLessThan(
        tx.prAttachment.findFirst.mock.invocationCallOrder[0],
      );
    }
  });

  it.each([
    { label: "file", change: { fileId: "file-2" } },
    { label: "request", change: { requestId: "request-2" } },
    { label: "task", change: { taskId: "task-2" } },
    { label: "kind", change: { kind: "EVIDENCE" } },
    { label: "absent request", change: { requestId: null } },
    { label: "absent task", change: { taskId: null } },
  ])("keeps a different $label key separate", async ({ change }) => {
    const existing = seed();
    const result = await createAttachment(actor, input(change));

    expect(result.id).not.toBe(existing.id);
    expect(result).toMatchObject({ ...link, ...change });
    expect(rows).toHaveLength(2);
    expect(tx.prAttachment.create).toHaveBeenCalledOnce();
    expect(tx.prAuditEvent.create).toHaveBeenCalledOnce();
  });

  it("does not reuse a request-only link for a request-plus-task attachment", async () => {
    const existing = seed({ taskId: null });
    const result = await createAttachment(actor, input());
    expect(result.id).not.toBe(existing.id);
    expect(tx.prAttachment.create).toHaveBeenCalledOnce();
  });

  it("keeps new-file evidence versioning and creation audit intact", async () => {
    seed({ fileId: "older-file" });
    const result = await createAttachment(actor, input(), "new-file-correlation");
    expect(result).toMatchObject({ fileId: "file-1", version: 8 });
    expect(tx.prAuditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "attachment.created",
        entityId: result.id,
        correlationId: "new-file-correlation",
        after: link,
      }),
    });
  });
});
