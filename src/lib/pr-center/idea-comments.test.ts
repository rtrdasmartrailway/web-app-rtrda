import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, transactionClient } = vi.hoisted(() => {
  const transactionClient = {
    prComment: { create: vi.fn() },
    prAuditEvent: { create: vi.fn() },
    prOutboxEvent: { create: vi.fn() },
  };
  const mockPrisma = {
    prContentIdea: { findFirst: vi.fn() },
    prComment: { findMany: vi.fn() },
    $transaction: vi.fn(async (callback: (tx: typeof transactionClient) => unknown) =>
      callback(transactionClient),
    ),
  };
  return { mockPrisma, transactionClient };
});

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));

import { addIdeaComment, listIdeaComments, PrCenterError } from "./service";

const owner = {
  id: "user-owner",
  organizationId: "org-1",
  departmentId: "dept-2",
  role: "REQUESTER" as const,
};
const reviewer = {
  id: "user-pr",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "PR_OPERATIONS" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.prContentIdea.findFirst.mockResolvedValue({ id: "idea-1" });
  mockPrisma.prComment.findMany.mockResolvedValue([]);
  transactionClient.prComment.create.mockResolvedValue({
    id: "comment-1",
    ideaId: "idea-1",
    body: "Please clarify the audience.",
    authorId: reviewer.id,
    createdAt: new Date("2026-10-05T04:00:00.000Z"),
    author: { displayName: "PR Reviewer" },
  });
  transactionClient.prAuditEvent.create.mockResolvedValue({ id: "audit-1" });
  transactionClient.prOutboxEvent.create.mockResolvedValue({ id: "outbox-1" });
});

describe("idea comment scope and persistence", () => {
  it("lets the creator read comments even if their current department differs", async () => {
    await listIdeaComments(owner, "idea-1");
    const { where } = mockPrisma.prContentIdea.findFirst.mock.calls[0][0];
    expect(where).toEqual({
      id: "idea-1",
      organizationId: "org-1",
      OR: [{ proposerId: "user-owner" }],
    });
    expect(mockPrisma.prComment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ideaId: "idea-1" } }),
    );
  });

  it("lets an in-scope PR reviewer read and add append-only comments", async () => {
    await listIdeaComments(reviewer, "idea-1");
    const { where } = mockPrisma.prContentIdea.findFirst.mock.calls[0][0];
    expect(where.OR).toContainEqual({ departmentId: "dept-1" });

    await addIdeaComment(
      reviewer,
      "idea-1",
      "  Please clarify the audience.  ",
      "corr-1",
    );
    expect(transactionClient.prComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          ideaId: "idea-1",
          authorId: "user-pr",
          body: "Please clarify the audience.",
        },
      }),
    );
    expect(transactionClient.prAuditEvent.create).toHaveBeenCalledOnce();
    expect(transactionClient.prOutboxEvent.create).toHaveBeenCalledOnce();
    expect(transactionClient.prAuditEvent.create.mock.calls[0][0].data.after).toEqual({
      commentId: "comment-1",
    });
  });

  it("hides out-of-scope ideas from direct comment reads and writes", async () => {
    mockPrisma.prContentIdea.findFirst.mockResolvedValue(null);
    await expect(listIdeaComments(reviewer, "idea-elsewhere")).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    } satisfies Partial<PrCenterError>);
    await expect(
      addIdeaComment(reviewer, "idea-elsewhere", "No access"),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    } satisfies Partial<PrCenterError>);
    expect(mockPrisma.prComment.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(["", "   ", "x".repeat(2001), null])(
    "rejects an invalid comment body: %s",
    async (body) => {
      await expect(addIdeaComment(reviewer, "idea-1", body)).rejects.toMatchObject({
        statusCode: 422,
        code: "INVALID_COMMENT",
      });
      expect(mockPrisma.prContentIdea.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    },
  );
});
