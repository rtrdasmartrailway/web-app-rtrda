import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("Intro host continuity", () => {
  it("returns to the same site that served the Intro page", () => {
    for (const origin of ["https://test.rtrda.or.th", "https://www.rtrda.or.th"]) {
      const response = GET(new Request(origin + "/intro/enter"));
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe(origin + "/");
    }
  });

  it("links the Intro CTA on the current site rather than Test", () => {
    const source = readFileSync("src/app/intro/page.tsx", "utf8");
    expect(source).toContain('href="/intro/enter"');
    expect(source).not.toContain("https://test.rtrda.or.th/intro/enter");
  });
});
