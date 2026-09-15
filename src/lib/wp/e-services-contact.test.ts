import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { NACC_COMPLAINT_URL, PACC_COMPLAINT_URL } from "./contact-nav-override";
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
      '<div class="lightweight-accordion"><details><summary>คลังความรู้</summary><div class="lightweight-accordion-body"><ul class="wp-block-list"><li><a href="/คลังความรู้">คลังความรู้ สทร.</a></li></ul></div></details></div><div class="lightweight-accordion"><details><summary>ข้อมูลการติดต่อ</summary><div class="lightweight-accordion-body"><ul class="wp-block-list"><li><a href="https://infocenter.oic.go.th/rtrda/index.php"></a><a href="/ติดต่อเรา/ช่องทางการติดต่อ">ช่องทางการติดต่อ</a></li></ul></div></details></div>',
    modified: "2025-01-01T00:00:00",
    date: "2025-01-01T00:00:00",
    parentPath: null,
    categoryIds: [],
    featuredMediaId: null,
    ...overrides,
  };
}

describe("applyEServicesContactOverride", () => {
  it("replaces the original contact list item with table links", () => {
    const updated = applyEServicesContactOverride(record());
    const $ = cheerio.load(updated.contentHtml, null, false);

    expect($(".e-services-contact-table")).toHaveLength(1);
    expect($(".e-services-contact-table tbody tr")).toHaveLength(5);
    expect($(".e-services-contact-table thead")).toHaveLength(0);
    expect($(".e-services-contact-table").text()).toContain("ช่องทางการติดต่อ");
    expect($(".e-services-contact-table").text()).toContain(
      "ช่องทางการแจ้งเรื่องการทุจริตและประพฤติมิชอบ",
    );
    expect($(".e-services-contact-table").text()).toContain(
      "การรับเรื่องร้องเรียน / แจ้งเบาะแส",
    );
    expect($("a[href='" + NACC_COMPLAINT_URL + "']").attr("target")).toBe("_blank");
    expect($("a[href='" + PACC_COMPLAINT_URL + "']").attr("target")).toBe("_blank");
    expect(updated.contentHtml).not.toContain("saraban@rtrda.or.th");
    expect($(".e-services-contact-table iframe")).toHaveLength(0);
    expect($(".e-services-link-accordion")).toHaveLength(1);
    expect($(".e-services-link-accordion .wp-block-list")).toHaveLength(1);
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

    const $ = cheerio.load(updated.contentHtml, null, false);
    expect(updated.contentHtml).toContain(
      "Reporting Channels for Corruption and Misconduct",
    );
    expect($(".e-services-contact-table").text()).toContain("Contact Information");
    expect(updated.contentHtml).toContain("Complaints and Whistleblowing");
    expect(updated.contentHtml).toContain(NACC_COMPLAINT_URL);
    expect(updated.contentHtml).toContain(PACC_COMPLAINT_URL);
  });

  it("leaves unrelated pages unchanged and is idempotent", () => {
    const source = record({ path: "/เกี่ยวกับ-สทร" });
    const once = applyEServicesContactOverride(record());

    expect(applyEServicesContactOverride(source)).toBe(source);
    expect(applyEServicesContactOverride(once)).toBe(once);
  });
});
