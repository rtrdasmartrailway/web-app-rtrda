import { describe, expect, it } from "vitest";
import {
  extractInternalLinks,
  extractUploadUrls,
  sanitizeAndRewriteHtml,
} from "./html";

describe("WordPress HTML processing", () => {
  it("removes scripts and event handlers while preserving content markup", () => {
    const result = sanitizeAndRewriteHtml(
      '<section><h2>ข่าว</h2><p onclick="alert(1)">รายละเอียด</p><script>alert(1)</script></section>',
    );

    expect(result).toContain("<h2>ข่าว</h2>");
    expect(result).toContain("<p>รายละเอียด</p>");
    expect(result).not.toContain("script");
    expect(result).not.toContain("onclick");
  });

  it("rewrites RTRDA links and image sources but leaves external links intact", () => {
    const result = sanitizeAndRewriteHtml(
      '<a href="https://www.rtrda.or.th/en/contact/">Contact</a><a href="https://forms.gle/abc">Form</a><img src="https://www.rtrda.or.th/wp-content/uploads/2026/01/a.pdf" alt="file">',
    );

    expect(result).toContain('href="/en/contact"');
    expect(result).toContain('href="https://forms.gle/abc"');
    expect(result).toContain('src="/wp-content/uploads/2026/01/a.pdf"');
  });

  it("preserves WordPress search forms and points them at the Next search route", () => {
    const result = sanitizeAndRewriteHtml(
      '<form role="search" method="get" action="https://www.rtrda.or.th/"><label for="wp-search">Search</label><input id="wp-search" type="search" name="s" placeholder="Search"><button type="submit">Search</button></form>',
    );

    expect(result).toContain('<form role="search" method="get" action="/search">');
    expect(result).toContain('name="q"');
    expect(result).toContain('placeholder="Search"');
    expect(result).toContain('type="submit"');
  });

  it("preserves WordPress accordion details and summary markup", () => {
    const result = sanitizeAndRewriteHtml(
      '<div class="lightweight-accordion"><details open><summary class="lightweight-accordion-title"><span><strong>รายงานประจำปี</strong></span></summary><div class="lightweight-accordion-body">รายการเอกสาร</div></details></div>',
    );

    expect(result).toContain('<details open>');
    expect(result).toContain('<summary class="lightweight-accordion-title">');
    expect(result).toContain("รายงานประจำปี");
    expect(result).toContain("รายการเอกสาร");
  });

  it("extracts upload assets and internal links from rendered HTML", () => {
    const html =
      '<a href="https://www.rtrda.or.th/ข่าว/">ข่าว</a><img src="https://www.rtrda.or.th/wp-content/uploads/2026/01/a.jpg"><a href="/en/about">About</a>';

    expect(extractUploadUrls(html)).toEqual([
      "https://www.rtrda.or.th/wp-content/uploads/2026/01/a.jpg",
    ]);
    expect(extractInternalLinks(html)).toEqual(["/ข่าว", "/en/about"]);
  });
});
