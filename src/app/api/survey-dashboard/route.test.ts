import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GET } from "./route";

const originalToken = process.env.SURVEY_GOOGLE_TOKEN_FILE;
const originalPassword = process.env.SURVEY_DASHBOARD_PASSWORD_FILE;
let directory = "";
afterEach(async () => {
  if (originalToken === undefined) delete process.env.SURVEY_GOOGLE_TOKEN_FILE;
  else process.env.SURVEY_GOOGLE_TOKEN_FILE = originalToken;
  if (originalPassword === undefined) delete process.env.SURVEY_DASHBOARD_PASSWORD_FILE;
  else process.env.SURVEY_DASHBOARD_PASSWORD_FILE = originalPassword;
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = "";
  vi.restoreAllMocks();
});

function request(password?: string) {
  return new Request("http://localhost/api/survey-dashboard", {
    headers: password
      ? {
          authorization: `Basic ${Buffer.from(`rtrda-report:${password}`).toString("base64")}`,
        }
      : {},
  });
}

async function setup() {
  directory = await mkdtemp(join(tmpdir(), "survey-api-"));
  process.env.SURVEY_DASHBOARD_PASSWORD_FILE = join(directory, "password");
  await writeFile(
    process.env.SURVEY_DASHBOARD_PASSWORD_FILE,
    "test-secret-abcdefghijklmnopqrstuvwxyz\n",
  );
  process.env.SURVEY_GOOGLE_TOKEN_FILE = join(directory, "google.json");
  await writeFile(
    process.env.SURVEY_GOOGLE_TOKEN_FILE,
    JSON.stringify({
      client_id: "client",
      client_secret: "secret",
      refresh_token: "refresh",
      token_uri: "https://oauth2.googleapis.com/token",
    }),
  );
}

describe("private survey API", () => {
  it("fails closed without a mounted password and never fetches Sheets", async () => {
    delete process.env.SURVEY_DASHBOARD_PASSWORD_FILE;
    const fetcher = vi.spyOn(globalThis, "fetch");
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("blocks anonymous and wrong credentials before reading data", async () => {
    await setup();
    const fetcher = vi.spyOn(globalThis, "fetch");
    for (const req of [request(), request("incorrect")]) {
      const response = await GET(req);
      expect(response.status).toBe(401);
      expect(await response.text()).not.toContain("respondent");
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns every cell and the existing aggregates only after authentication, with no-store", async () => {
    await setup();
    const headers = Array.from({ length: 73 }, (_, index) => `Question ${index}`);
    const row = Array(73).fill("");
    row[2] = "Person Name";
    row[4] = "private@example.com";
    row[72] = "last answer";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ values: [headers, row] })));
    const response = await GET(request("test-secret-abcdefghijklmnopqrstuvwxyz"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const data = await response.json();
    expect(data.summary.totalResponses).toBe(1);
    expect(data.headers).toEqual(headers);
    expect(data.responses[0].cells).toEqual(row);
    expect(data.responses[0].sheetRow).toBe(2);
    expect(JSON.stringify(data)).not.toContain("test-secret-abcdefghijklmnopqrstuvwxyz");
  });
});
