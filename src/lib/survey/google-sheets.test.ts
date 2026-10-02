import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSurveySummary } from "./google-sheets";

let directory = "";
afterEach(async () => {
  vi.restoreAllMocks();
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = "";
});

describe("Google Sheets read-only adapter", () => {
  it("refreshes OAuth then reads values and returns only aggregates", async () => {
    directory = await mkdtemp(join(tmpdir(), "survey-test-"));
    const path = join(directory, "token.json");
    await writeFile(
      path,
      JSON.stringify({
        client_id: "test-client",
        client_secret: "secret-password",
        refresh_token: "refresh-secret",
        token_uri: "https://oauth2.googleapis.com/token",
      }),
    );
    const row = Array(73).fill("");
    row[0] = "respondent timestamp";
    row[4] = "private@example.com";
    row[14] = "2 - level";
    row[5] = "บริษัทเอกชน";
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-secret" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ values: [Array(73).fill("header"), row] }), {
          status: 200,
        }),
      );
    const result = await readSurveySummary(path);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[0][0])).toBe("https://oauth2.googleapis.com/token");
    expect(String(fetcher.mock.calls[1][0])).toContain(
      "sheets.googleapis.com/v4/spreadsheets/",
    );
    expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({
      Authorization: "Bearer access-secret",
    });
    expect(fetcher.mock.calls[1][1]?.cache).toBe("no-store");
    expect(result.totalResponses).toBe(1);
    expect(JSON.stringify(result)).not.toMatch(
      /private@example|respondent timestamp|secret-password|access-secret|test-client/,
    );
  });

  it("rejects non-Google token endpoints before any outbound request", async () => {
    directory = await mkdtemp(join(tmpdir(), "survey-test-"));
    const path = join(directory, "token.json");
    await writeFile(
      path,
      JSON.stringify({
        client_id: "a",
        client_secret: "b",
        refresh_token: "c",
        token_uri: "https://evil.example/token",
      }),
    );
    const fetcher = vi.spyOn(globalThis, "fetch");
    await expect(readSurveySummary(path)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
