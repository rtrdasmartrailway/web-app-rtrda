import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, tx } = vi.hoisted(() => {
  const tx = {
    prTaskFactCheck: { create: vi.fn() },
    prAuditEvent: { create: vi.fn() },
    prOutboxEvent: { create: vi.fn() },
  };
  const prisma = {
    prTask: { findFirst: vi.fn() },
    ...tx,
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((callback) => callback(tx));
  return { prisma, tx };
});

vi.mock("@/lib/db/client", () => ({ prisma }));

import { submitTaskFactCheck, type PrCenterActor } from "./service";

const owner: PrCenterActor = {
  id: "owner-1",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "RTRDA_ALL_USER",
};
const claim = {
  claim: "The project serves 10 stations",
  evidenceUrl: "https://example.org/report",
  result: "VERIFIED" as const,
  note: "Confirmed against report table 2",
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation((callback) => callback(tx));
  prisma.prTask.findFirst.mockResolvedValue({
    id: "task-1",
    ownerId: owner.id,
    status: "IN_PRODUCTION",
    request: { status: "APPROVED", departmentId: "dept-1" },
    revisions: [{ revisionNumber: 4 }],
  });
  tx.prTaskFactCheck.create.mockResolvedValue({
    id: "fact-check-1",
    taskId: "task-1",
    taskRevision: 4,
    checkedAt: new Date("2026-10-12T12:00:00Z"),
    checkedBy: { displayName: "Assigned owner" },
    summary: "Source is current",
    items: [{ ...claim, id: "item-1" }],
  });
  tx.prAuditEvent.create.mockResolvedValue({});
  tx.prOutboxEvent.create.mockResolvedValue({});
});

describe("task fact-check records", () => {
  it("lets the assigned owner save an immutable, revision-linked evidence record", async () => {
    const result = await submitTaskFactCheck(
      owner,
      "task-1",
      [claim],
      "Source is current",
      "fact-check-correlation",
    );

    expect(prisma.prTask.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "task-1",
          request: expect.objectContaining({
            OR: expect.arrayContaining([{ tasks: { some: { ownerId: owner.id } } }]),
          }),
        },
      }),
    );
    expect(tx.prTaskFactCheck.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskId: "task-1",
        taskRevision: 4,
        checkedById: owner.id,
        summary: "Source is current",
        items: {
          create: [
            expect.objectContaining({
              claim: claim.claim,
              evidenceUrl: claim.evidenceUrl,
              result: "VERIFIED",
            }),
          ],
        },
      }),
      include: expect.any(Object),
    });
    expect(tx.prAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: owner.id,
          action: "task.fact_check_submitted",
          correlationId: "fact-check-correlation",
        }),
      }),
    );
    expect(result.taskRevision).toBe(4);
  });

  it("allows a PR role to check a task owned by another user", async () => {
    prisma.prTask.findFirst.mockResolvedValueOnce({
      id: "task-1",
      ownerId: "other-owner",
      status: "SOURCE_FACT_CHECK",
      request: { status: "APPROVED", departmentId: "dept-1" },
      revisions: [{ revisionNumber: 4 }],
    });
    const prActor: PrCenterActor = { ...owner, id: "pr-1", role: "RTRDA_PR" };

    await expect(submitTaskFactCheck(prActor, "task-1", [claim])).resolves.toMatchObject({
      id: "fact-check-1",
    });
    expect(tx.prTaskFactCheck.create).toHaveBeenCalledTimes(1);
  });

  it("rejects a requester whose PR grant belongs to another department", async () => {
    const actor: PrCenterActor = {
      ...owner,
      role: "RTRDA_PR",
      roleGrants: [{ role: "RTRDA_PR", departmentId: "dept-2" }],
    };
    prisma.prTask.findFirst.mockResolvedValueOnce({
      id: "task-1",
      ownerId: "other-owner",
      status: "SOURCE_FACT_CHECK",
      request: { status: "APPROVED", departmentId: "dept-1" },
      revisions: [{ revisionNumber: 4 }],
    });

    await expect(submitTaskFactCheck(actor, "task-1", [claim])).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
    expect(tx.prTaskFactCheck.create).not.toHaveBeenCalled();
  });

  it("preserves task-owner access despite an unrelated scoped PR grant", async () => {
    const actor: PrCenterActor = {
      ...owner,
      role: "RTRDA_PR",
      roleGrants: [{ role: "RTRDA_PR", departmentId: "dept-2" }],
    };
    await expect(submitTaskFactCheck(actor, "task-1", [claim])).resolves.toMatchObject({
      id: "fact-check-1",
    });
  });

  it("allows an organization-wide PR grant for a task in another department", async () => {
    const actor: PrCenterActor = {
      ...owner,
      id: "pr-global",
      role: "RTRDA_ALL_USER",
      roleGrants: [
        { role: "RTRDA_ALL_USER", departmentId: "dept-1" },
        { role: "RTRDA_PR", departmentId: null },
      ],
    };
    prisma.prTask.findFirst.mockResolvedValueOnce({
      id: "task-1",
      ownerId: "other-owner",
      status: "SOURCE_FACT_CHECK",
      request: { status: "APPROVED", departmentId: "dept-2" },
      revisions: [{ revisionNumber: 4 }],
    });
    await expect(submitTaskFactCheck(actor, "task-1", [claim])).resolves.toMatchObject({
      id: "fact-check-1",
    });
  });

  it("denies a non-owner without the PR role", async () => {
    const other: PrCenterActor = { ...owner, id: "other-user" };

    await expect(submitTaskFactCheck(other, "task-1", [claim])).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("requires an HTTPS evidence URL before writing", async () => {
    await expect(
      submitTaskFactCheck(owner, "task-1", [
        { ...claim, evidenceUrl: "http://example.org/report" },
      ]),
    ).rejects.toMatchObject({
      code: "INVALID_FACT_CHECK",
      statusCode: 422,
    });
    expect(tx.prTaskFactCheck.create).not.toHaveBeenCalled();
  });
});
