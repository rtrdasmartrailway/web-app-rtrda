import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

let directory = "";
const original = process.env.SURVEY_DASHBOARD_PASSWORD_FILE;
afterEach(async () => {
  vi.unstubAllEnvs();
  if (original === undefined) delete process.env.SURVEY_DASHBOARD_PASSWORD_FILE;
  else process.env.SURVEY_DASHBOARD_PASSWORD_FILE = original;
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = "";
});

describe("staging activity correlation privacy", () => {
  it("overrides broad shared-cache headers only while Test logging is enabled", async () => {
    vi.stubEnv("ACTIVITY_LOGGING_ENABLED", "true");
    vi.stubEnv("ANALYTICS_ENV", "test");
    vi.stubEnv("SITE_ORIGIN", "https://test.rtrda.or.th");
    for (const path of [
      "/api/analytics/events",
      "/sdc_download/example",
      "/r/mot-5440",
    ]) {
      const response = await proxy(new NextRequest(`https://test.rtrda.or.th${path}`));
      expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
      expect(response.headers.get("cdn-cache-control")).toBe("no-store");
    }
    vi.stubEnv("ANALYTICS_ENV", "production");
    const response = await proxy(new NextRequest("https://test.rtrda.or.th/r/mot-5440"));
    expect(response.headers.get("cache-control")).not.toBe(
      "private, no-store, max-age=0",
    );
  });
});

describe("production public PDF framing", () => {
  it("allows same-origin framing on production logged-file rewrites", async () => {
    vi.stubEnv("ACTIVITY_LOGGING_ENABLED", "true");
    vi.stubEnv("ACTIVITY_DEPLOY_MODE", "collect");
    vi.stubEnv("ANALYTICS_ENV", "production");
    vi.stubEnv("SITE_ORIGIN", "https://rtrda.or.th");
    vi.stubEnv("ACTIVITY_RECORDING_HOST", "cloud");
    vi.stubEnv("ACTIVITY_RETENTION_ENABLED", "true");
    vi.stubEnv("ANALYTICS_HASH_SALT_FILE", "");
    vi.stubEnv("ANALYTICS_HASH_SALT", "abcdefghijklmnopqrstuvwxyz0123456789");
    const response = await proxy(
      new NextRequest("https://rtrda.or.th/risk-reports/no-gift-policy/report-2569.pdf", {
        headers: { host: "rtrda.or.th" },
      }),
    );
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://rtrda.or.th/logged-files-internal/risk-reports/no-gift-policy/report-2569.pdf",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(response.headers.get("content-security-policy")).toBe(
      "frame-ancestors 'self'",
    );
  });
});

describe("survey page/API proxy", () => {
  it("preserves existing public request policy while requiring survey credentials", async () => {
    delete process.env.SURVEY_DASHBOARD_PASSWORD_FILE;
    const response = await proxy(new NextRequest("http://localhost/healthz"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
  it("blocks unauthenticated page and API without leaking personal data", async () => {
    directory = await mkdtemp(join(tmpdir(), "survey-proxy-"));
    process.env.SURVEY_DASHBOARD_PASSWORD_FILE = join(directory, "password");
    await writeFile(
      process.env.SURVEY_DASHBOARD_PASSWORD_FILE,
      "test-secret-abcdefghijklmnopqrstuvwxyz\n",
    );
    for (const path of ["/rtrdaintranet/survey-dashboard", "/api/survey-dashboard"]) {
      const response = await proxy(new NextRequest(`http://localhost${path}`));
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.text()).not.toContain("respondent");
    }
  });
  it("returns 503 if the password secret is missing", async () => {
    delete process.env.SURVEY_DASHBOARD_PASSWORD_FILE;
    expect(
      (await proxy(new NextRequest("http://localhost/rtrdaintranet/survey-dashboard")))
        .status,
    ).toBe(503);
  });
});

describe("Intro root behind a reverse proxy", () => {
  it("redirects to the public HTTPS Intro instead of the internal request URL", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:39877/", {
        headers: {
          host: "localhost:39877",
          "x-forwarded-host": "www.rtrda.or.th",
          "x-forwarded-proto": "https",
        },
      }),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://www.rtrda.or.th/intro");
  });
});
