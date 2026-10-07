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

describe("Intro reverse-proxy origin", () => {
  it("uses the allowlisted forwarded host when Next.js reports its internal URL", () => {
    const response = GET(
      new Request("https://localhost:39877/intro/enter", {
        headers: {
          host: "localhost:39877",
          "x-forwarded-host": "www.rtrda.or.th",
        },
      }),
    );
    expect(response.headers.get("location")).toBe("https://www.rtrda.or.th/");
  });

  it("keeps the public Host ahead of a conflicting forwarded host", () => {
    const response = GET(
      new Request("https://localhost:39877/intro/enter", {
        headers: {
          host: "test.rtrda.or.th",
          "x-forwarded-host": "www.rtrda.or.th",
        },
      }),
    );
    expect(response.headers.get("location")).toBe("https://test.rtrda.or.th/");
  });

  it("never redirects to an unknown external host", () => {
    const response = GET(new Request("https://untrusted.example/intro/enter"));
    expect(response.headers.get("location")).toBe("https://www.rtrda.or.th/");
  });
});
