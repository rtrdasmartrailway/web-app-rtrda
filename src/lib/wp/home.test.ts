import { describe, expect, it } from "vitest";
import { dayKey, extractPartnerLogos } from "./home";

describe("extractPartnerLogos", () => {
  it("extracts upload images under the final (partners) heading", () => {
    const html =
      '<h2>News</h2><img src="/wp-content/uploads/news.png">' +
      "<h2>Our Partners</h2>" +
      '<img src="/wp-content/uploads/a.png"><img src="/wp-content/uploads/b.png">';
    expect(extractPartnerLogos(html)).toEqual([
      "/wp-content/uploads/a.png",
      "/wp-content/uploads/b.png",
    ]);
  });

  it("dedupes and ignores non-upload images", () => {
    const html =
      '<h2>Partners</h2><img src="/wp-content/uploads/a.png">' +
      '<img src="https://cdn/x.png"><img src="/wp-content/uploads/a.png">';
    expect(extractPartnerLogos(html)).toEqual(["/wp-content/uploads/a.png"]);
  });

  it("returns [] for empty/headingless content", () => {
    expect(extractPartnerLogos("")).toEqual([]);
    expect(extractPartnerLogos("<p>no images</p>")).toEqual([]);
  });
});

describe("dayKey", () => {
  it("takes the date part of an ISO string", () => {
    expect(dayKey("2026-06-09T07:52:02.737Z")).toBe("2026-06-09");
    expect(dayKey("2026-01-15T00:00:00")).toBe("2026-01-15");
  });
});
