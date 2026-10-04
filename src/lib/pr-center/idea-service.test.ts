import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transactionClient = {
    prContentIdea: { create: vi.fn() },
    prAuditEvent: { create: vi.fn() },
    prOutboxEvent: { create: vi.fn() },
  };
  const transaction = vi.fn(
    async (callback: (client: typeof transactionClient) => unknown) =>
      callback(transactionClient),
  );
  return { transactionClient, transaction };
});

vi.mock("@/lib/db/client", () => ({ prisma: { $transaction: mocks.transaction } }));

import { createIdea } from "./service";

describe("createIdea persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transactionClient.prContentIdea.create.mockResolvedValue({
      id: "idea-1",
      status: "PROPOSED",
      version: 1,
      createdAt: new Date("2026-10-04T00:00:00.000Z"),
    });
    mocks.transactionClient.prAuditEvent.create.mockResolvedValue({ id: "audit-1" });
    mocks.transactionClient.prOutboxEvent.create.mockResolvedValue({ id: "outbox-1" });
  });

  it("persists structured fields and records the mutation transactionally", async () => {
    await createIdea(
      {
        id: "user-1",
        organizationId: "org-1",
        departmentId: "dept-1",
        role: "REQUESTER",
      },
      {
        title: "Safer road travel",
        rationale: "Explain the safety campaign",
        audience: "Commuters",
        pillar: "Safety",
        channel: "Facebook",
        priority: "High",
        campaign: "Road safety",
        evidenceUrls: ["https://example.org/source"],
      },
      "corr-1",
    );

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.transactionClient.prContentIdea.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        departmentId: "dept-1",
        proposerId: "user-1",
        title: "Safer road travel",
        rationale: "Explain the safety campaign",
        audience: "Commuters",
        pillar: "Safety",
        channel: "Facebook",
        priority: "High",
        campaign: "Road safety",
        evidenceUrls: ["https://example.org/source"],
      }),
    });
    expect(mocks.transactionClient.prAuditEvent.create).toHaveBeenCalledOnce();
    expect(mocks.transactionClient.prOutboxEvent.create).toHaveBeenCalledOnce();
  });
});
