import { describe, expect, it } from "vitest";
import {
  classifyTarget,
  detectAnalyticsDevice,
  isObviousBot,
  normalizeAnalyticsPath,
  parseAnalyticsEvent,
  safeReferrerHost,
} from "./event-contract";

const valid = {
  eventId: "018f31c0-5e90-7d1d-9d5c-111111111111",
  eventType: "page_view",
  path: "/ข่าว?utm_source=test#section",
  targetPath: null,
  sessionId: "018f31c0-5e90-7d1d-9d5c-222222222222",
  source: "external",
};

describe("analytics event contract", () => {
  it("strips query strings, fragments, and duplicate slashes", () => {
    expect(normalizeAnalyticsPath("/ข่าว//ล่าสุด?utm_source=x#top")).toBe("/ข่าว/ล่าสุด");
  });

  it("rejects absolute, control-character, API, health, and intranet paths", () => {
    for (const path of [
      "https://evil.test/x",
      "/x\nheader",
      "/api/private",
      "/healthz",
      "/rtrdaintranet/blog",
    ]) {
      expect(parseAnalyticsEvent({ ...valid, path })).toBeNull();
    }
  });

  it("accepts and normalizes a valid page view without retaining query data", () => {
    expect(parseAnalyticsEvent(valid)).toMatchObject({ path: "/ข่าว", targetPath: null });
  });

  it("requires a safe target for click and download events", () => {
    expect(parseAnalyticsEvent({ ...valid, eventType: "download" })).toBeNull();
    expect(
      parseAnalyticsEvent({
        ...valid,
        eventType: "download",
        targetPath: "/file.pdf?token=secret",
      }),
    ).toMatchObject({ targetPath: "/file.pdf" });
  });

  it("classifies document routes and normal links", () => {
    expect(classifyTarget("/sdc_download/5540")).toBe("download");
    expect(classifyTarget("/uploads/report.PDF")).toBe("download");
    expect(classifyTarget("/ข่าว")).toBe("link_click");
  });

  it("stores only the referrer hostname", () => {
    expect(safeReferrerHost("https://example.com/private?q=secret")).toBe("example.com");
    expect(safeReferrerHost("not a URL")).toBeNull();
  });

  it("coarsely classifies devices and obvious bots", () => {
    expect(detectAnalyticsDevice("Mozilla/5.0 (iPhone) Mobile")).toBe("mobile");
    expect(detectAnalyticsDevice("Mozilla/5.0 (iPad) Tablet")).toBe("tablet");
    expect(detectAnalyticsDevice("Mozilla/5.0 (Macintosh)")).toBe("desktop");
    expect(isObviousBot("Googlebot/2.1")).toBe(true);
    expect(isObviousBot("Mozilla/5.0 (Macintosh)")).toBe(false);
  });
});
