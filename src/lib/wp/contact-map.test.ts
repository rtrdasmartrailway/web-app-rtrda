import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import type { WpContentRecord } from "./types";
import { applyContactMapOverride, RTRDA_CONTACT_MAP_EMBED_URL } from "./contact-map";

const CONTACT_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSd8nY4Dt-vjvl6Ag4Jnwq_Ko5zEUT7FgKH8DB-wql74KAVe5w/viewform";

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

  it("rewrites the Thai contact page map iframe to the RTRDA named Google place", () => {
    const updated = applyContactMapOverride(record({}));

    expect(iframeSrc(updated.contentHtml)).toBe(RTRDA_CONTACT_MAP_EMBED_URL);
    expect(decodeURIComponent(iframeSrc(updated.contentHtml) ?? "")).toContain(
      "สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน)",
    );
    expect(updated.contentHtml).toContain("13.7505783");
    expect(updated.contentHtml).toContain("100.5681343");
    expect(updated.contentHtml).toContain('width="600"');
    expect(updated.contentHtml).toContain('height="450"');
    expect(updated.contentHtml).toContain("contact-map-place-card");
    expect(updated.contentHtml).toContain("เปิดใน Google Maps");
    expect(updated.contentHtml).toContain("0x30e29f004355d1b7:0xd97ebac98e579c96");
  });

  it("promotes the Google contact form link to a visible CTA", () => {
    const updated = applyContactMapOverride(
      record({
        contentHtml:
          '<div class="elementor-widget-button"><a class="elementor-button" href="https://forms.gle/z7bMYh5qMdHBoG2HA" target="_blank">ช่องทางการติดต่อ</a></div><p>Address</p>',
      }),
    );
    const $ = cheerio.load(updated.contentHtml, null, false);
    const cta = $(".contact-form-cta");

    expect(cta).toHaveLength(1);
    expect(cta.find("strong")).toHaveLength(0);
    expect(cta.find("p")).toHaveLength(0);
    expect(cta.find("a")).toHaveLength(1);
    expect(cta.find("a").attr("href")).toBe(CONTACT_FORM_URL);
    expect(cta.find("a").attr("target")).toBe("_blank");
    expect(cta.find("a").attr("rel")).toBe("noreferrer");
    expect($.root().children().first().hasClass("contact-form-cta")).toBe(true);
    expect($(".elementor-widget-button")).toHaveLength(0);
    expect(updated.contentHtml).not.toContain("https://forms.gle/z7bMYh5qMdHBoG2HA");
  });

  it("adds official RTRDA social media hrefs to the contact page icons", () => {
    const updated = applyContactMapOverride(
      record({
        contentHtml:
          '<div class="elementor-social-icons-wrapper">' +
          '<a class="elementor-icon elementor-social-icon-facebook" target="_blank" href><span>Facebook</span></a>' +
          '<a class="elementor-icon elementor-social-icon-twitter" target="_blank" href><span>Twitter</span></a>' +
          '<a class="elementor-icon elementor-social-icon-youtube" target="_blank" href><span>YouTube</span></a>' +
          '<a class="elementor-icon elementor-social-icon-linkedin" target="_blank" href><span>LinkedIn</span></a>' +
          '<a class="elementor-icon elementor-social-icon-tiktok" target="_blank" href><span>TikTok</span></a>' +
          "</div>",
      }),
    );
    const $ = cheerio.load(updated.contentHtml, null, false);

    expect($(".elementor-social-icon-facebook").attr("href")).toBe(
      "https://www.facebook.com/rtrda.thailand/",
    );
    expect($(".elementor-social-icon-twitter").attr("href")).toBe(
      "https://twitter.com/RtrdaT",
    );
    expect($(".elementor-social-icon-youtube").attr("href")).toBe(
      "https://www.youtube.com/channel/UC_bEnCUi9VXjB6s7OvtLPzg",
    );
    expect($(".elementor-social-icon-linkedin").attr("href")).toBe(
      "https://www.linkedin.com/company/rail-technology-research-and-development-agency/",
    );
    expect($(".elementor-social-icon-tiktok").attr("href")).toBe(
      "https://www.tiktok.com/@rtrda.thailand",
    );
    expect($(".elementor-social-icon-facebook").attr("rel")).toBe("noreferrer");
    expect($(".elementor-social-icon-facebook").attr("aria-label")).toBe("Facebook");
  });

  it("uses an English label for the contact form CTA on English pages", () => {
    const updated = applyContactMapOverride(
      record({
        id: "en-page-452",
        language: "en",
        path: "/en/ติดต่อเรา/ช่องทางการติดต่อ",
        title: "Contact Information",
        contentHtml:
          '<a class="elementor-button" href="https://forms.gle/z7bMYh5qMdHBoG2HA">ช่องทางการติดต่อ</a>',
      }),
    );

    expect(updated.contentHtml).toContain("Contact Form");
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
    expect(updated.contentHtml).toContain("Open in Google Maps");
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
