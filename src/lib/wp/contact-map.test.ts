import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import type { WpContentRecord } from "./types";
import { applyContactMapOverride, RTRDA_CONTACT_MAP_EMBED_URL } from "./contact-map";

function record(overrides: Partial<WpContentRecord>): WpContentRecord {
  return {
    id: "th-page-452",
    wpId: "452",
    language: "th",
    kind: "page",
    path: "/ติดต่อเรา/ช่องทางการติดต่อ",
    sourceUrl: "https://www.rtrda.or.th/ติดต่อเรา/ช่องทางการติดต่อ/",
    title: "ช่องทางการติดต่อ",
    excerpt: "",
    contentHtml:
      '<p>Address</p><iframe loading="lazy" src="https://www.google.com/maps/embed?pb=old" width="600" height="450" allowfullscreen="allowfullscreen"></iframe>',
    modified: "2025-01-01T00:00:00",
    date: "2025-01-01T00:00:00",
    parentPath: "/ติดต่อเรา",
    categoryIds: [],
    featuredMediaId: null,
    ...overrides,
  };
}

describe("applyContactMapOverride", () => {
  function iframeSrc(html: string): string | undefined {
    return cheerio.load(html, null, false)("iframe").attr("src");
  }

  it("rewrites the Thai contact page map iframe to the RTRDA coordinates", () => {
    const updated = applyContactMapOverride(record({}));

    expect(iframeSrc(updated.contentHtml)).toBe(RTRDA_CONTACT_MAP_EMBED_URL);
    expect(updated.contentHtml).toContain("13.7505783");
    expect(updated.contentHtml).toContain("100.5681343");
    expect(updated.contentHtml).toContain('width="600"');
    expect(updated.contentHtml).toContain('height="450"');
  });

  it("rewrites the English contact page map iframe to the same RTRDA coordinates", () => {
    const updated = applyContactMapOverride(
      record({
        id: "en-page-452",
        language: "en",
        path: "/en/ติดต่อเรา/ช่องทางการติดต่อ",
        title: "Contact Information",
      }),
    );

    expect(iframeSrc(updated.contentHtml)).toBe(RTRDA_CONTACT_MAP_EMBED_URL);
  });

  it("leaves non-contact pages unchanged", () => {
    const source = record({
      path: "/เกี่ยวกับ-สทร",
      contentHtml:
        '<p>Other page</p><iframe src="https://www.google.com/maps/embed?pb=old"></iframe>',
    });

    expect(applyContactMapOverride(source)).toBe(source);
  });
});
