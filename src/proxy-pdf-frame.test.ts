import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
import nextConfig from "../next.config";

afterEach(() => vi.unstubAllEnvs());

describe("production PDF rewrite", () => {
  it("applies same-origin headers on the internal document route", async () => {
    const routes = await nextConfig.headers?.();
    const route = routes?.find(
      (entry) => entry.source === "/logged-files-internal/:path*",
    );
    const headers = new Map(route?.headers.map(({ key, value }) => [key, value]));
    expect(headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(headers.get("Content-Security-Policy")).toBe("frame-ancestors 'self'");
    expect(headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("retains same-origin framing for a logged public PDF", () => {
    vi.stubEnv("ACTIVITY_LOGGING_ENABLED", "true");
    vi.stubEnv("ANALYTICS_ENV", "production");
    vi.stubEnv("SITE_ORIGIN", "https://rtrda.or.th");
    vi.stubEnv("ACTIVITY_RECORDING_HOST", "cloud");
    vi.stubEnv("ACTIVITY_RETENTION_ENABLED", "true");
    vi.stubEnv("ANALYTICS_HASH_SALT_FILE", "");
    vi.stubEnv("ANALYTICS_HASH_SALT", "abcdefghijklmnopqrstuvwxyz0123456789");
    const response = proxy(
      new NextRequest("https://rtrda.or.th/risk-reports/no-gift-policy/report-2569.pdf", {
        headers: { host: "rtrda.or.th" },
      }),
    );
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://rtrda.or.th/logged-files-internal/risk-reports/no-gift-policy/report-2569.pdf",
    );
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(response.headers.get("content-security-policy")).toBe(
      "frame-ancestors 'self'",
    );
  });
});
