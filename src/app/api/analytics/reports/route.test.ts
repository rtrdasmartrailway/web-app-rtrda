import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  report: vi.fn(),
  enabled: vi.fn(() => true),
  host: vi.fn(() => true),
}));
vi.mock("@/lib/analytics/activity-auth", () => ({
  requireActivityAdmin: mocks.admin,
  PRIVATE_HEADERS: { "Cache-Control": "private, no-store" },
}));
vi.mock("@/lib/analytics/activity-store", () => ({
  activityEnabled: mocks.enabled,
  activityHostAllowed: mocks.host,
}));
vi.mock("@/lib/analytics/activity-report", () => ({
  activityReport: mocks.report,
  reportFilter: () => ({}),
  reportCsv: () => "",
  activityRecordingSource: () => "cloud production database",
}));
import { GET } from "./route";
afterEach(() => { vi.clearAllMocks(); mocks.enabled.mockReturnValue(true); mocks.host.mockReturnValue(true); });
it("denies an unauthenticated report before querying the database", async () => {
  mocks.admin.mockResolvedValueOnce(new Response(null, { status: 401 }));
  const response = await GET(new Request("https://rtrda.or.th/api/analytics/reports"));
  expect(response.status).toBe(401);
  expect(mocks.report).not.toHaveBeenCalled();
});
it("denies a mismatched public host before querying the database", async () => {
  mocks.admin.mockResolvedValueOnce(null);
  mocks.host.mockReturnValueOnce(false);
  const response = await GET(new Request("https://evil.example/api/analytics/reports"));
  expect(response.status).toBe(503);
  expect(mocks.report).not.toHaveBeenCalled();
});
