import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isSameOriginAnalyticsRequest } from "./route";

function request(
  origin: string | null,
  host = "test.rtrda.or.th",
  fetchSite = "same-origin",
) {
  const headers: Record<string, string> = { host, "sec-fetch-site": fetchSite };
  if (origin) headers.origin = origin;
  return new NextRequest("https://test.rtrda.or.th/api/analytics/events", {
    method: "POST",
    headers,
  });
}

describe("analytics collector origin policy", () => {
  it("allows same-origin browser requests", () => {
    expect(isSameOriginAnalyticsRequest(request("https://test.rtrda.or.th"))).toBe(true);
  });

  it("rejects cross-site and mismatched origins", () => {
    expect(
      isSameOriginAnalyticsRequest(
        request("https://evil.example", "test.rtrda.or.th", "cross-site"),
      ),
    ).toBe(false);
    expect(isSameOriginAnalyticsRequest(request("https://evil.example"))).toBe(false);
  });

  it("accepts a missing Origin only when browser metadata says same-origin", () => {
    expect(isSameOriginAnalyticsRequest(request(null))).toBe(true);
    expect(
      isSameOriginAnalyticsRequest(request(null, "test.rtrda.or.th", "cross-site")),
    ).toBe(false);
  });
});
