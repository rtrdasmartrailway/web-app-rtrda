import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transactionClient = {
    prContentIdea: {
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    prRequest: { create: vi.fn() },
    prAuditEvent: { create: vi.fn() },
    prOutboxEvent: { create: vi.fn() },
  };
  const transaction = vi.fn(
    async (callback: (client: typeof transactionClient) => unknown) =>
      callback(transactionClient),
  );
  return {
    transactionClient,
    transaction,
    findFirst: vi.fn(),
  };
});

vi.mock("@/lib/db/client", () => ({
  prisma: {
    $transaction: mocks.transaction,
    prContentIdea: { findFirst: mocks.findFirst },
  },
}));

import { convertIdea, transitionIdea } from "./service";

const actor = {
  id: "reviewer-1",
  organizationId: "org-1",
  departmentId: "dept-home",
  scopeDepartmentId: "dept-1",
  role: "PR_OPERATIONS" as const,
};

describe("idea reviewer scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transactionClient.prContentIdea.updateMany.mockResolvedValue({ count: 1 });
    mocks.transactionClient.prContentIdea.findUniqueOrThrow.mockResolvedValue({
      id: "idea-1",
      status: "UNDER_REVIEW",
      version: 4,
    });
    mocks.transactionClient.prRequest.create.mockResolvedValue({
      id: "request-1",
      tasks: [{ id: "task-1" }],
    });
    mocks.transactionClient.prAuditEvent.create.mockResolvedValue({ id: "audit-1" });
    mocks.transactionClient.prOutboxEvent.create.mockResolvedValue({ id: "outbox-1" });
  });

  it("scopes idea review lookup and optimistic update to the role grant department", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "idea-1",
      organizationId: "org-1",
      departmentId: "dept-1",
      status: "PROPOSED",
      version: 3,
    });

    await transitionIdea(actor, "idea-1", 3, "UNDER_REVIEW", undefined, "corr-1");

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: "idea-1", organizationId: "org-1", departmentId: "dept-1" },
    });
    expect(mocks.transactionClient.prContentIdea.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "idea-1",
          organizationId: "org-1",
          departmentId: "dept-1",
          version: 3,
        },
      }),
    );
  });

  it("requires a non-empty reason when an idea is rejected", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "idea-1",
      organizationId: "org-1",
      departmentId: "dept-1",
      status: "UNDER_REVIEW",
      version: 3,
    });

    await expect(
      transitionIdea(actor, "idea-1", 3, "REJECTED", "  ", "corr-reject"),
    ).rejects.toMatchObject({ statusCode: 422, code: "REASON_REQUIRED" });
    expect(mocks.transactionClient.prContentIdea.updateMany).not.toHaveBeenCalled();
  });

  it("persists a trimmed rejection reason with the rejected status", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "idea-1",
      organizationId: "org-1",
      departmentId: "dept-1",
      status: "UNDER_REVIEW",
      version: 3,
    });

    await transitionIdea(
      actor,
      "idea-1",
      3,
      "REJECTED",
      "  Needs a clearer public benefit.  ",
      "corr-reject",
    );

    expect(mocks.transactionClient.prContentIdea.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "idea-1",
          organizationId: "org-1",
          departmentId: "dept-1",
          version: 3,
        },
        data: expect.objectContaining({
          status: "REJECTED",
          decisionReason: "Needs a clearer public benefit.",
        }),
      }),
    );
  });

  it("denies conversion to non-reviewers before reading the idea", async () => {
    await expect(
      convertIdea({ ...actor, role: "REQUESTER" }, "idea-1", 3, "corr-3"),
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects a repeated conversion without creating another request", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "idea-1",
      organizationId: "org-1",
      departmentId: "dept-1",
      status: "CONVERTED",
      version: 4,
      convertedRequestId: "request-1",
    });

    await expect(convertIdea(actor, "idea-1", 4, "corr-repeat")).rejects.toMatchObject({
      statusCode: 422,
      code: "INVALID_TRANSITION",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.transactionClient.prRequest.create).not.toHaveBeenCalled();
  });

  it("rejects a stale conversion before starting a transaction", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "idea-1",
      organizationId: "org-1",
      departmentId: "dept-1",
      status: "ACCEPTED",
      version: 4,
    });

    await expect(convertIdea(actor, "idea-1", 3, "corr-stale")).rejects.toMatchObject({
      statusCode: 409,
      code: "STALE_UPDATE",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns not found for an idea outside the reviewer grant scope", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(
      convertIdea(actor, "idea-outside", 3, "corr-scope"),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("scopes accepted-idea conversion and its conditional update to the grant department", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "idea-1",
      organizationId: "org-1",
      departmentId: "dept-1",
      proposerId: "author-1",
      title: "Idea",
      rationale: "Rationale",
      audience: "Public",
      status: "ACCEPTED",
      version: 3,
    });

    await convertIdea(actor, "idea-1", 3, "corr-2");

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: "idea-1", organizationId: "org-1", departmentId: "dept-1" },
    });
    expect(mocks.transactionClient.prContentIdea.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "idea-1",
          organizationId: "org-1",
          departmentId: "dept-1",
          status: "ACCEPTED",
          version: 3,
        },
      }),
    );
  });
});
