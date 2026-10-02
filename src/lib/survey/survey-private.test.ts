import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkSurveyAccess } from "./survey-private";

let directory = "";
const oldPath = process.env.SURVEY_DASHBOARD_PASSWORD_FILE;
afterEach(async () => {
  if (oldPath === undefined) delete process.env.SURVEY_DASHBOARD_PASSWORD_FILE;
  else process.env.SURVEY_DASHBOARD_PASSWORD_FILE = oldPath;
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = "";
});

describe("private survey access", () => {
  it("fails closed if the password file is absent or unreadable", async () => {
    delete process.env.SURVEY_DASHBOARD_PASSWORD_FILE;
    expect((await checkSurveyAccess(new Headers()))?.status).toBe(503);
    process.env.SURVEY_DASHBOARD_PASSWORD_FILE = "/nonexistent-survey-password";
    expect((await checkSurveyAccess(new Headers()))?.status).toBe(503);
  });

  it("challenges missing, wrong, malformed, and wrong-username credentials", async () => {
    directory = await mkdtemp(join(tmpdir(), "survey-access-"));
    process.env.SURVEY_DASHBOARD_PASSWORD_FILE = join(directory, "password");
    await writeFile(
      process.env.SURVEY_DASHBOARD_PASSWORD_FILE,
      "strong-test-password-0123456789\n",
    );
    for (const authorization of [
      undefined,
      "Basic !!!",
      `Basic ${Buffer.from("other:strong-test-password-0123456789").toString("base64")}`,
      `Basic ${Buffer.from("rtrda-report:incorrect").toString("base64")}`,
    ]) {
      const headers = new Headers();
      if (authorization) headers.set("authorization", authorization);
      const result = await checkSurveyAccess(headers);
      expect(result?.status).toBe(401);
      expect(result?.headers.get("www-authenticate")).toContain("Basic");
      expect(result?.headers.get("cache-control")).toContain("no-store");
      expect(await result?.text()).not.toContain("strong-test-password-0123456789");
    }
  });

  it("allows exactly the fixed username and password, trimming only a trailing newline", async () => {
    directory = await mkdtemp(join(tmpdir(), "survey-access-"));
    process.env.SURVEY_DASHBOARD_PASSWORD_FILE = join(directory, "password");
    await writeFile(
      process.env.SURVEY_DASHBOARD_PASSWORD_FILE,
      "strong-test-password-0123456789\n",
    );
    const headers = new Headers({
      authorization: `Basic ${Buffer.from("rtrda-report:strong-test-password-0123456789").toString("base64")}`,
    });
    expect(await checkSurveyAccess(headers)).toBeNull();
    headers.set(
      "authorization",
      `Basic ${Buffer.from("rtrda-report:strong-test-password-0123456789 ").toString("base64")}`,
    );
    expect((await checkSurveyAccess(headers))?.status).toBe(401);
  });
});
