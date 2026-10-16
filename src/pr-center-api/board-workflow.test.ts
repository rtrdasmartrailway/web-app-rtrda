import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db/client", () => ({ prisma: {} }));
import { buildPrCenterApi } from "./app";
const policy = {
  version: "test",
  approvalReference: "Test workflow",
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
describe("board workflow metadata", () => {
  it("returns the active workflow for PR without database writes", async () => {
    vi.stubEnv("PR_CENTER_APPROVAL_POLICY_JSON", JSON.stringify(policy));
    const app = buildPrCenterApi(async () => ({
      id: "pr",
      organizationId: "org",
      departmentId: null,
      role: "RTRDA_PR",
    }));
    const response = await app.inject({
      method: "GET",
      url: "/workflow/approval-policy",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(policy);
    await app.close();
  });
  it("rejects requester-only and unauthenticated access", async () => {
    for (const actor of [
      null,
      {
        id: "requester",
        organizationId: "org",
        departmentId: null,
        role: "RTRDA_ALL_USER" as const,
      },
    ]) {
      const app = buildPrCenterApi(async () => actor);
      expect(
        (await app.inject({ method: "GET", url: "/workflow/approval-policy" }))
          .statusCode,
      ).toBe(actor ? 403 : 401);
      await app.close();
    }
  });
});
