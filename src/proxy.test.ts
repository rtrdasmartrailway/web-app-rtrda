import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

let directory = "";
const original = process.env.SURVEY_DASHBOARD_PASSWORD_FILE;
afterEach(async () => {
  if (original === undefined) delete process.env.SURVEY_DASHBOARD_PASSWORD_FILE;
  else process.env.SURVEY_DASHBOARD_PASSWORD_FILE = original;
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = "";
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
