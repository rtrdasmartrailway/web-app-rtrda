import { describe, expect, it } from "vitest";
import { verifyLandingPage } from "./check-live-security-landing.mjs";

const target = new URL("https://test.rtrda.or.th/");

describe("live security landing check", () => {
  it("accepts a same-origin Intro redirect only when Intro returns 200", async () => {
    const root = new Response(null, {
      status: 307,
      headers: { location: "https://test.rtrda.or.th/intro" },
    });
    let requested = "";
    const pages = await verifyLandingPage(target, root, async (url, options) => {
      requested = String(url);
      expect(options).toEqual({ redirect: "manual" });
      return new Response("intro", { status: 200 });
    });
    expect(requested).toBe("https://test.rtrda.or.th/intro");
    expect(pages).toHaveLength(2);
  });

  it("keeps a normal 200 homepage valid", async () => {
    const page = new Response("home", { status: 200 });
    expect(
      await verifyLandingPage(target, page, () => {
        throw new Error("unexpected fetch");
      }),
    ).toEqual([page]);
  });

  it.each(["https://evil.example/intro", "https://test.rtrda.or.th/other"])(
    "rejects an unexpected redirect destination %s",
    async (location) => {
      const root = new Response(null, { status: 307, headers: { location } });
      await expect(
        verifyLandingPage(target, root, () => {
          throw new Error("unexpected fetch");
        }),
      ).rejects.toThrow();
    },
  );

  it("rejects an unhealthy Intro destination", async () => {
    const root = new Response(null, {
      status: 307,
      headers: { location: "https://test.rtrda.or.th/intro" },
    });
    await expect(
      verifyLandingPage(target, root, async () => new Response(null, { status: 404 })),
    ).rejects.toThrow("Intro expected 200");
  });
});
