import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { RTRDA_CONTACT_MAP_EMBED_URL } from "./contact-map";
import { applyEServicesContactOverride } from "./e-services-contact";
import type { WpContentRecord } from "./types";

function record(overrides: Partial<WpContentRecord> = {}): WpContentRecord {
  return {
    id: "th-page-5509",
    wpId: "5509",
    language: "th",
    kind: "page",
    path: "/e-services",
    sourceUrl: "https://www.rtrda.or.th/e-services",
    title: "e-Services",
    excerpt: "",
    contentHtml:
      '<div class="lightweight-accordion"><details><summary>ข้อมูลการติดต่อ</summary><div class="lightweight-accordion-body"><p><a href="/ติดต่อเรา/ช่องทางการติดต่อ">ช่องทางการติดต่อ</a></p></div></details></div>',
    modified: "2025-01-01T00:00:00",
    date: "2025-01-01T00:00:00",
    parentPath: null,
    categoryIds: [],
    featuredMediaId: null,
    ...overrides,
  };
}

describe("applyEServicesContactOverride", () => {
  it("adds the requested Thai contact details and Google map to e-services", () => {
    const updated = applyEServicesContactOverride(record());
    const $ = cheerio.load(updated.contentHtml, null, false);

    expect($(".e-services-contact-table")).toHaveLength(1);
    expect($(".e-services-contact-table").text()).toContain("อาคารศูนย์บริหารทางพิเศษ");
    expect($(".e-services-contact-table").text()).toContain("saraban@rtrda.or.th");
    expect($(".e-services-contact-table").text()).toContain("info@rtrda.or.th");
    expect($(".e-services-contact-table").text()).toContain("082 204 2998");
    expect($(".e-services-contact-table iframe").attr("src")).toBe(
      RTRDA_CONTACT_MAP_EMBED_URL,
    );
    expect($(".e-services-contact-map-link").attr("target")).toBe("_blank");
  });

  it("adds an English table to the English e-services page", () => {
    const updated = applyEServicesContactOverride(
      record({
        id: "en-page-5509",
        language: "en",
        path: "/en/e-services",
        contentHtml:
          '<div class="lightweight-accordion"><details><summary>Contact Information</summary><div class="lightweight-accordion-body"></div></details></div>',
      }),
    );

    expect(updated.contentHtml).toContain("Official correspondence email");
    expect(updated.contentHtml).toContain("Open in Google Maps");
  });

  it("leaves unrelated pages unchanged and is idempotent", () => {
    const source = record({ path: "/เกี่ยวกับ-สทร" });
    const once = applyEServicesContactOverride(record());

    expect(applyEServicesContactOverride(source)).toBe(source);
    expect(applyEServicesContactOverride(once)).toBe(once);
  });
});
