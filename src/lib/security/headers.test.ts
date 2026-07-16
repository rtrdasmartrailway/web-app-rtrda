import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";
import {
  CONTENT_SECURITY_POLICY,
  CONTENT_SECURITY_POLICY_REPORT_ONLY,
  SECURITY_HEADERS,
} from "./headers";

describe("security headers", () => {
  it("defines the required browser hardening headers", () => {
    const headers = new Map(SECURITY_HEADERS.map(({ key, value }) => [key, value]));

    expect(headers.get("Strict-Transport-Security")).toBe("max-age=86400");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Content-Security-Policy")).toBe(CONTENT_SECURITY_POLICY);
    expect(headers.get("Content-Security-Policy-Report-Only")).toBe(
      CONTENT_SECURITY_POLICY_REPORT_ONLY,
    );
  });

  it("enforces a compatibility-safe CSP while monitoring a stricter script policy", () => {
    expect(CONTENT_SECURITY_POLICY).toContain("default-src 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain(
      "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
    );
    expect(CONTENT_SECURITY_POLICY).toContain(
      "connect-src 'self' https://cloudflareinsights.com",
    );

    expect(CONTENT_SECURITY_POLICY_REPORT_ONLY).toContain("script-src 'self'");
    expect(CONTENT_SECURITY_POLICY_REPORT_ONLY).not.toContain(
      "script-src 'self' 'unsafe-inline'",
    );
  });

  it("wires the shared headers into Next.js and hides the framework banner", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    const routes = await nextConfig.headers?.();
    const globalRoute = routes?.find((route) => route.source === "/:path*");
    const headers = new Map(globalRoute?.headers.map(({ key, value }) => [key, value]));

    for (const { key, value } of SECURITY_HEADERS) {
      expect(headers.get(key)).toBe(value);
    }
  });
});
