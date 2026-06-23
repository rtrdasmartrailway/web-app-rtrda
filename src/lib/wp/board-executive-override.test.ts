import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";
import type { WpContentRecord } from "./types";
import {
  applyBoardExecutiveOverride,
  TACHAKORN_IMAGE_SRC,
} from "./board-executive-override";

function record(overrides: Partial<WpContentRecord>): WpContentRecord {
  return {
    id: "th-page-402",
    wpId: 402,
    language: "th",
    kind: "page",
    path: "/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร",
    sourceUrl: "https://www.rtrda.or.th/example",
    title: "คณะกรรมการและผู้บริหาร",
    excerpt: "",
    contentHtml: "",
    modified: "2026-01-01T00:00:00",
    date: "2026-01-01T00:00:00",
    parentPath: null,
    categoryIds: [],
    featuredMediaId: null,
    ...overrides,
  };
}

describe("applyBoardExecutiveOverride", () => {
  it("rewrites the Thai research and standards manager card", () => {
    const updated = applyBoardExecutiveOverride(
      record({
        contentHtml: `
          <div class="lightweight-accordion">
            <div class="wp-block-column">
              <img class="wp-image-6668" style="width:175px;height:auto" src="/wp-content/uploads/2025/10/ดร.กิติพันธุ์-นุตยกุล-ผู้จัดการกลุ่มวิจัยและมาตรฐาน.jpg" srcset="old.jpg 2063w" sizes="auto" alt="" />
              <h4 class="wp-block-heading">ดร.กิติพันธุ์ นุตยกุล</h4>
              <h5 class="wp-block-heading">ผู้จัดการกลุ่มวิจัยและมาตรฐาน<br />อีเมล: <a href="mailto:kitiphan.n@rtrda.or.th">kitiphan.n@rtrda.or.th</a></h5>
            </div>
          </div>
        `,
      }),
    );
    const $ = cheerio.load(updated.contentHtml, null, false);
    const image = $("img").first();

    expect($("h4").text()).toBe("ธัชกร ธนวัฒนาดำรง");
    expect($("h5").text()).toBe(
      "ผู้จัดการกลุ่มวิจัยและมาตรฐานอีเมล: touchakorn.t@rtrda.or.th",
    );
    expect($("a").attr("href")).toBe("mailto:touchakorn.t@rtrda.or.th");
    expect(image.attr("src")).toBe(TACHAKORN_IMAGE_SRC);
    expect(image.attr("alt")).toBe("ธัชกร ธนวัฒนาดำรง");
    expect(image.attr("class")).toContain("wp-image-6668");
    expect(image.attr("style")).toContain("width:175px");
    expect(image.attr("srcset")).toBeUndefined();
    expect(image.attr("sizes")).toBeUndefined();
  });

  it("leaves non-Thai board executive records unchanged", () => {
    const source = record({
      language: "en",
      path: "/en/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร",
      contentHtml: "<h4>ดร.กิติพันธุ์ นุตยกุล</h4>",
    });

    expect(applyBoardExecutiveOverride(source)).toBe(source);
  });

  it("leaves matching Thai records unchanged when the target card is absent", () => {
    const source = record({ contentHtml: "<h4>คนอื่น</h4>" });

    expect(applyBoardExecutiveOverride(source)).toBe(source);
  });
});
