import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const original = process.env.SURVEY_GOOGLE_TOKEN_FILE;
afterEach(() => {
  if (original === undefined) delete process.env.SURVEY_GOOGLE_TOKEN_FILE;
  else process.env.SURVEY_GOOGLE_TOKEN_FILE = original;
  vi.restoreAllMocks();
});

describe("public survey API", () => {
  it("fails closed without a mounted credential and does not expose internals", async () => {
    delete process.env.SURVEY_GOOGLE_TOKEN_FILE;
    const fetcher = vi.spyOn(globalThis, "fetch");
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ error: "ข้อมูลยังไม่พร้อมใช้งาน" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
