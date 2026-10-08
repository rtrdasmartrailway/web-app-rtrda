import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transactionClient = {
    prContentIdea: {
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    prRequest: { create: vi.fn() },
    prUserRole: { findMany: vi.fn() },
    prNotification: { createMany: vi.fn() },
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

import { convertIdea, reviseIdea, transitionIdea } from "./service";

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
    mocks.transactionClient.prUserRole.findMany.mockResolvedValue([]);
    mocks.transactionClient.prNotification.createMany.mockResolvedValue({ count: 1 });
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
      where: { id: "idea-1", organizationId: "org-1", OR: [{ departmentId: "dept-1" }] },
    });
    expect(mocks.transactionClient.prContentIdea.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "idea-1",
          organizationId: "org-1",
          OR: [{ departmentId: "dept-1" }],
          version: 3,
        },
      }),
    );
  });

  it.each(["ACCEPTED", "REJECTED"] as const)(
    "requires a non-empty reason when an idea is %s",
    async (to) => {
      mocks.findFirst.mockResolvedValue({
        id: "idea-1",
        organizationId: "org-1",
        departmentId: "dept-1",
        status: to === "ACCEPTED" ? "PENDING_APPROVAL" : "UNDER_REVIEW",
        version: 3,
      });

      await expect(
        transitionIdea(
          to === "ACCEPTED" ? { ...actor, role: "APPROVER" as const } : actor,
          "idea-1",
          3,
          to,
          "  ",
          "corr-decision",
        ),
      ).rejects.toMatchObject({ statusCode: 422, code: "REASON_REQUIRED" });
      expect(mocks.transactionClient.prContentIdea.updateMany).not.toHaveBeenCalled();
    },
  );

  it("persists a trimmed rejection reason with the rejected status", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "idea-1",
      organizationId: "org-1",
      departmentId: "dept-1",
      status: "PENDING_APPROVAL",
      version: 3,
    });

    await transitionIdea(
      { ...actor, role: "APPROVER" },
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
          OR: [{ departmentId: "dept-1" }],
          version: 3,
        },
        data: expect.objectContaining({
          status: "REJECTED",
          decisionReason: "Needs a clearer public benefit.",
        }),
      }),
    );
    expect(mocks.transactionClient.prAuditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        actorId: "reviewer-1",
        action: "idea.transitioned",
        entityId: "idea-1",
        correlationId: "corr-reject",
        after: {
          from: "PENDING_APPROVAL",
          to: "REJECTED",
          version: 4,
          reason: "Needs a clearer public benefit.",
        },
      }),
    });
  });

  it("persists and audits the trimmed acceptance rationale", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "idea-1",
      organizationId: "org-1",
      departmentId: "dept-1",
      status: "PENDING_APPROVAL",
      version: 3,
    });

    await transitionIdea(
      { ...actor, role: "APPROVER" },
      "idea-1",
      3,
      "ACCEPTED",
      "  Fits the approved safety campaign.  ",
      "corr-accept",
    );

    expect(mocks.transactionClient.prContentIdea.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ACCEPTED",
          decisionReason: "Fits the approved safety campaign.",
        }),
      }),
    );
    expect(mocks.transactionClient.prAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          correlationId: "corr-accept",
          after: expect.objectContaining({
            from: "PENDING_APPROVAL",
            to: "ACCEPTED",
            reason: "Fits the approved safety campaign.",
          }),
        }),
      }),
    );
  });

  it("lets the proposer revise a returned idea and resubmits it to PR review", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "idea-1",
      organizationId: "org-1",
      departmentId: "dept-1",
      proposerId: "author-1",
      status: "REVISION_REQUIRED",
      version: 5,
    });
    mocks.transactionClient.prUserRole.findMany.mockResolvedValue([
      { userId: "pr-recipient" },
    ]);
    const author = { ...actor, id: "author-1", role: "REQUESTER" as const };

    await reviseIdea(
      author,
      "idea-1",
      5,
      {
        title: "Revised safety idea",
        rationale: "A clearer public-benefit rationale",
        evidenceUrls: ["https://example.org/source"],
      },
      "corr-revise",
    );

    expect(mocks.transactionClient.prContentIdea.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "idea-1",
          proposerId: "author-1",
          status: "REVISION_REQUIRED",
          version: 5,
        }),
        data: expect.objectContaining({
          title: "Revised safety idea",
          status: "UNDER_REVIEW",
          reviewerId: null,
          decisionReason: null,
        }),
      }),
    );
    expect(mocks.transactionClient.prNotification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ userId: "pr-recipient", target: "idea:idea-1" }),
      ]),
    });
  });

  it("preserves an acceptance rationale when archiving the accepted idea", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "idea-1",
      organizationId: "org-1",
      departmentId: "dept-1",
      status: "ACCEPTED",
      version: 4,
      decisionReason: "Fits the approved safety campaign.",
    });

    await transitionIdea(actor, "idea-1", 4, "ARCHIVED", undefined, "corr-archive");

    expect(mocks.transactionClient.prContentIdea.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ARCHIVED",
          decisionReason: "Fits the approved safety campaign.",
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
      where: { id: "idea-1", organizationId: "org-1", OR: [{ departmentId: "dept-1" }] },
    });
    expect(mocks.transactionClient.prContentIdea.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "idea-1",
          organizationId: "org-1",
          OR: [{ departmentId: "dept-1" }],
          status: "ACCEPTED",
          version: 3,
        },
      }),
    );
  });
});
