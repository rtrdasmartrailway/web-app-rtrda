import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { sanitizeAndRewrite, stripImportedChrome } from "./import-wordpress-sanitize.mjs";

describe("stripImportedChrome", () => {
  it("removes the VK ExUnit social share box", () => {
    const html =
      '<p>เนื้อหา</p><div class="veu_socialSet veu_socialSet-position-after veu_contentAddSection">' +
      '<ul><li class="sb_facebook sb_icon"><a><span class="sns_txt">Facebook</span></a></li>' +
      '<li class="sb_twitter sb_icon"><a><span class="sns_txt">twitter</span></a></li></ul></div>';
    const out = stripImportedChrome(html);
    expect(out).toBe("<p>เนื้อหา</p>");
    expect(out).not.toMatch(/Facebook|twitter/);
  });

  it("removes follow boxes and post meta but keeps real content", () => {
    const html =
      '<div class="followSet">follow</div><p>keep</p><div class="vk_post">meta</div>';
    expect(stripImportedChrome(html)).toBe("<p>keep</p>");
  });

  it("leaves the agency's real social-links block intact", () => {
    const html =
      '<ul class="wp-block-social-links"><li class="wp-social-link wp-social-link-facebook">' +
      '<a href="https://facebook.com/x"><span class="wp-block-social-link-label">Facebook</span></a></li></ul>';
    expect(stripImportedChrome(html)).toContain("wp-block-social-links");
    expect(stripImportedChrome(html)).toContain("facebook.com/x");
  });

  it("handles empty input", () => {
    expect(stripImportedChrome("")).toBe("");
    expect(stripImportedChrome(null)).toBe("");
  });
});

describe("sanitizeAndRewrite", () => {
  it("strips chrome as part of sanitizing", () => {
    const out = sanitizeAndRewrite(
      '<p>ok</p><div class="veu_socialSet"><span>Hatena</span></div>',
    );
    expect(out).toContain("ok");
    expect(out).not.toMatch(/Hatena/);
  });

  it("preserves <colgroup> and <col> with style/width for table layout", () => {
    const out = sanitizeAndRewrite(
      '<table><colgroup><col style="width:60px"><col></colgroup><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>',
    );
    const $ = cheerio.load(out, null, false);
    const cols = $("colgroup col");
    expect($("colgroup")).toHaveLength(1);
    expect(cols).toHaveLength(2);
    expect(cols.first().attr("style")).toBe("width:60px");
    expect($("th").text()).toBe("Header");
    expect($("td").text()).toBe("Cell");
  });

  it("preserves the download attribute for local document links", () => {
    const out = sanitizeAndRewrite(
      '<a href="/wp-content/uploads/report.pdf" download="download">ดาวน์โหลด</a>',
    );

    expect(out).toContain("download");
  });
});
