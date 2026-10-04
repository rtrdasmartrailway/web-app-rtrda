import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPrCenterApi } from "./app";

const { listQueue, decideRequest } = vi.hoisted(() => ({
  listQueue: vi.fn(),
  decideRequest: vi.fn(),
}));

vi.mock("@/lib/pr-center/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pr-center/service")>();
  return {
    ...actual,
    listRequestApprovalQueue: listQueue,
    recordRequestDecision: decideRequest,
  };
});

const requestId = "00000000-0000-4000-8000-000000000001";
const requester = {
  id: "requester-1",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "REQUESTER" as const,
};
const prActor = { ...requester, id: "pr-1", role: "PR_OPERATIONS" as const };

afterEach(() => vi.clearAllMocks());

describe("request intake approval API", () => {
  it("requires authentication and forwards the PR identity to the queue service", async () => {
    const anonymousApp = buildPrCenterApi(async () => null);
    const anonymous = await anonymousApp.inject({
      method: "GET",
      url: "/request-approvals",
    });
    expect(anonymous.statusCode).toBe(401);
    await anonymousApp.close();

    listQueue.mockResolvedValue([]);
    const prApp = buildPrCenterApi(async () => prActor);
    const response = await prApp.inject({
      method: "GET",
      url: "/request-approvals",
    });
    expect(response.statusCode).toBe(200);
    expect(listQueue).toHaveBeenCalledWith(prActor);
    await prApp.close();
  });

  it("lists the queue for PR and forwards versioned decisions", async () => {
    listQueue.mockResolvedValue([{ id: requestId, status: "SUBMITTED" }]);
    decideRequest.mockResolvedValue({ id: requestId, status: "REJECTED" });
    const app = buildPrCenterApi(async () => prActor);

    const queue = await app.inject({ method: "GET", url: "/request-approvals" });
    expect(queue.statusCode).toBe(200);
    expect(queue.json()).toEqual([{ id: requestId, status: "SUBMITTED" }]);
    expect(listQueue).toHaveBeenCalledWith(prActor);

    const decision = await app.inject({
      method: "POST",
      url: `/requests/${requestId}/decisions`,
      headers: { "if-match": "2" },
      payload: { decision: "REJECTED", reason: "Incomplete brief" },
    });
    expect(decision.statusCode).toBe(200);
    expect(decideRequest).toHaveBeenCalledWith(
      prActor,
      requestId,
      2,
      { decision: "REJECTED", reason: "Incomplete brief" },
      expect.any(String),
    );
    await app.close();
  });

  it("rejects unknown decisions before invoking the service", async () => {
    const app = buildPrCenterApi(async () => prActor);
    const response = await app.inject({
      method: "POST",
      url: `/requests/${requestId}/decisions`,
      headers: { "if-match": "2" },
      payload: { decision: "WITHDRAWN" },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error).toBe("INVALID_DECISION");
    expect(decideRequest).not.toHaveBeenCalled();
    await app.close();
  });

  it("does not expose a hard-delete route for user requests", async () => {
    const app = buildPrCenterApi(async () => prActor);
    const response = await app.inject({
      method: "DELETE",
      url: `/requests/${requestId}`,
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
