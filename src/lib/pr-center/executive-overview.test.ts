import { describe, expect, it } from "vitest";
import {
  createExecutiveOverviewExport,
  getExecutiveWorkflowCounts,
} from "./executive-overview";

const allStatuses = [
  "draft",
  "communication_planning",
  "waiting_for_information",
  "in_production",
  "source_fact_check",
  "technical_review",
  "pr_editorial_review",
  "management_approval",
  "revision_required",
  "approved",
  "scheduled",
  "published",
  "closed",
  "cancelled",
  "rejected",
] as const;

describe("executive overview", () => {
  it("counts each workflow stage from the canonical task statuses", () => {
    const counts = getExecutiveWorkflowCounts(
      allStatuses.map((status) => ({ status })),
      [{ status: "SUBMITTED" }, { status: "APPROVED" }, {}],
    );

    expect(counts).toEqual({
      published: 2,
      pending: 2,
      planning: 2,
      waiting: 1,
      production: 3,
      approved: 1,
      scheduled: 1,
      activeTasks: 11,
      submittedRequests: 1,
    });
  });

  it("keeps analytics unavailable instead of exporting fabricated values", () => {
    const counts = getExecutiveWorkflowCounts([], []);
    const result = createExecutiveOverviewExport({
      generatedAt: new Date("2026-10-16T00:00:00.000Z"),
      scopeLabel: "authorized data only",
      counts,
      totalRequests: 0,
      totalTasks: 0,
      unavailableReason: "No verified metric data source yet",
    });

    expect(result.metrics).toEqual({
      published: null,
      reach: null,
      interactions: null,
      engagementRate: null,
      unavailableReason: "No verified metric data source yet",
      sampleData: null,
    });
    expect(result.generatedAt).toBe("2026-10-16T00:00:00.000Z");
    expect(result.scope).toBe("authorized data only");
  });

  it("exports the same filtered spreadsheet totals and rate as the outcome cards", () => {
    const result = createExecutiveOverviewExport({
      generatedAt: new Date("2026-10-16T00:00:00.000Z"),
      scopeLabel: "authorized data only",
      counts: getExecutiveWorkflowCounts([], []),
      totalRequests: 0,
      totalTasks: 0,
      unavailableReason: "No data",
      sheet: {
        fetchedAt: "2026-10-16T00:00:00.000Z",
        sampleData: true,
        recordCount: 2,
        unclassifiedRows: 0,
        totals: { posts: 2, viewers: 200, comments: 10 },
        monthly: [{ month: "2026-10", posts: 2 }],
        platforms: [],
      },
    });
    expect(result.metrics).toEqual({
      published: 2,
      reach: 200,
      interactions: 10,
      engagementRate: 5,
      unavailableReason: null,
      sampleData: true,
    });
  });
});
