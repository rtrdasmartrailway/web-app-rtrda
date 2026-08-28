import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";
import type { WpContentRecord } from "./types";
import {
  applyBoardExecutiveOverride,
  CHAIYUT_IMAGE_SRC,
  CHAIYUT_NAME,
  TACHAKORN_IMAGE_SRC,
  WEERADET_IMAGE_SRC,
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

  it("fills the internal-admin manager card with Chaiyut Tanchai", () => {
    const updated = applyBoardExecutiveOverride(
      record({
        contentHtml: `
          <div class="lightweight-accordion">
            <div class="wp-block-column">
              <div class="wp-block-image is-style-default">
                <figure class="aligncenter size-full is-resized">
                  <img loading="lazy" decoding="async" width="240" height="240"
                    src="/wp-content/uploads/2024/05/IMG_2233.png"
                    srcset="/wp-content/uploads/2024/05/IMG_2233.png 240w"
                    sizes="auto" alt=""
                    style="width:118px;height:auto" />
                </figure>
              </div>
              <h4 class="wp-block-heading">–</h4>
              <h5 class="wp-block-heading">ผู้จัดการกลุ่มบริหารภายใน<br />อีเมล: <a href="mailto:kanyasiri.p@rtrda.or.th">–</a></h5>
            </div>
          </div>
        `,
      }),
    );
    const $ = cheerio.load(updated.contentHtml, null, false);
    const image = $("img").first();
    const heading = $("h4").first();
    const role = $("h5").first();

    expect(image.attr("src")).toBe(CHAIYUT_IMAGE_SRC);
    expect(image.attr("alt")).toBe(CHAIYUT_NAME);
    expect(image.attr("srcset")).toBeUndefined();
    expect(image.attr("sizes")).toBeUndefined();
    expect(heading.text()).toBe(CHAIYUT_NAME);
    expect(role.text()).toBe(
      "ผู้จัดการกลุ่มบริหารภายใน (รักษาการแทน)อีเมล: chaiwooth.t@rtrda.or.th",
    );
    expect(role.find('a[href^="mailto:"]').length).toBe(1);
    expect(role.find("a").attr("href")).toBe("mailto:chaiwooth.t@rtrda.or.th");
  });

  it("rewrites Pichet's Thai and English board role", () => {
    const thai = applyBoardExecutiveOverride(
      record({
        contentHtml: `<div class="lightweight-accordion"><div class="wp-block-column"><h4>ดร. พิเชฐ คุณาธรรมรักษ์</h4><h5>กรรมการโดยตำแหน่ง อธิบดีกรมการขนส่งทางราง</h5></div></div>`,
      }),
    );
    const english = applyBoardExecutiveOverride(
      record({
        language: "en",
        path: "/en/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร",
        contentHtml: `<div class="lightweight-accordion"><div class="wp-block-column"><h4>ดร. พิเชฐ คุณาธรรมรักษ์</h4><h5>กรรมการโดยตำแหน่ง อธิบดีกรมการขนส่งทางราง</h5></div></div>`,
      }),
    );

    expect(cheerio.load(thai.contentHtml, null, false)("h5").text()).toBe(
      "กรรมการอธิบดีกรมการขนส่งทางราง",
    );
    expect(cheerio.load(english.contentHtml, null, false)("h5").text()).toBe(
      "Member, Board of DirectorDirector-General, Department of Rail Transport",
    );
  });

  it("rewrites Pattanaphong's Thai and English board role", () => {
    const thai = applyBoardExecutiveOverride(
      record({
        contentHtml: `<div class="lightweight-accordion"><div class="wp-block-column"><h4>พัฒนพงษ์ พงศ์ศุภสมิทธิ์</h4><h5>กรรมการโดยตำแหน่ง ผู้แทนผู้ว่าการการรถไฟฟ้าขนส่งมวลชนแห่งประเทศไทย</h5></div></div>`,
      }),
    );
    const english = applyBoardExecutiveOverride(
      record({
        language: "en",
        path: "/en/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร",
        contentHtml: `<div class="lightweight-accordion"><div class="wp-block-column"><h4>Pattanaphong Phongsupatsamit</h4><h5>กรรมการโดยตำแหน่ง</h5></div></div>`,
      }),
    );

    expect(cheerio.load(thai.contentHtml, null, false)("h5").text()).toBe(
      "กรรมการรองผู้ว่าการ รฟม. (บริหาร)ผู้แทนผู้ว่าการ รฟม.",
    );
    expect(cheerio.load(english.contentHtml, null, false)("h5").text()).toBe(
      "Member, Board of DirectorDeputy Governor (Administration)Mass Transit Railway Authority of Thailand",
    );
  });

  it("shows the Thai secretary suffix on Piang-or's board role", () => {
    const thai = applyBoardExecutiveOverride(
      record({
        contentHtml: `<div class="lightweight-accordion"><div class="wp-block-column"><h4>ดร. เพียงออ เลาหะวิไลย</h4><h5>กรรมการและเลขานุการ</h5></div></div>`,
      }),
    );
    const english = applyBoardExecutiveOverride(
      record({
        language: "en",
        path: "/en/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร",
        contentHtml: `<div class="lightweight-accordion"><div class="wp-block-column"><h4>Dr. Piang-or Loahavilai</h4><h5>Member &amp; Secretary</h5></div></div>`,
      }),
    );

    expect(cheerio.load(thai.contentHtml, null, false)("h5").text()).toBe(
      "กรรมการและเลขานุการฯ",
    );
    expect(cheerio.load(english.contentHtml, null, false)("h5").text()).toBe(
      "Member & Secretary",
    );
  });

  it("removes Thavorn's card from Thai and English board pages", () => {
    const source = `<div class="lightweight-accordion"><div class="wp-block-column"><h4>ถาวร ชลัษเฐียร</h4><h5>ที่ปรึกษาคณะกรรมการ</h5></div><div class="wp-block-column"><h4>คนอื่น</h4><h5>กรรมการ</h5></div></div>`;
    const thai = applyBoardExecutiveOverride(record({ contentHtml: source }));
    const english = applyBoardExecutiveOverride(
      record({
        language: "en",
        path: "/en/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร",
        contentHtml: source.replace("ถาวร ชลัษเฐียร", "Thavorn Chalassathien"),
      }),
    );
    const $thai = cheerio.load(thai.contentHtml, null, false);
    const $english = cheerio.load(english.contentHtml, null, false);

    expect(
      $thai("h4")
        .map((_, element) => $thai(element).text())
        .get(),
    ).toEqual(["คนอื่น"]);
    expect(
      $english("h4")
        .map((_, element) => $english(element).text())
        .get(),
    ).toEqual(["คนอื่น"]);
  });

  it("replaces the railway representative card with Weeradet", () => {
    const thai = applyBoardExecutiveOverride(
      record({
        contentHtml: `<div class="lightweight-accordion"><div class="wp-block-column"><img src="old.jpg" srcset="old.jpg 400w" sizes="auto" alt="" /><h4>ผู้แทน ผู้ว่าการรถไฟแห่งประเทศไทย</h4><h5>กรรมการโดยตำแหน่ง ผู้ว่าการรถไฟแห่งประเทศไทย</h5></div></div>`,
      }),
    );
    const english = applyBoardExecutiveOverride(
      record({
        language: "en",
        path: "/en/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร",
        contentHtml: `<div class="lightweight-accordion"><div class="wp-block-column"><img src="old.jpg" srcset="old.jpg 400w" sizes="auto" alt="" /><h4>ผู้แทน ผู้ว่าการรถไฟแห่งประเทศไทย</h4><h5>กรรมการโดยตำแหน่ง ผู้ว่าการรถไฟแห่งประเทศไทย</h5></div></div>`,
      }),
    );

    expect(cheerio.load(thai.contentHtml, null, false)("h4").text()).toBe(
      "ดร. วีรเดช ชีวาพัฒนานุวงศ์",
    );
    expect(cheerio.load(thai.contentHtml, null, false)("h5").text()).toBe(
      "กรรมการผู้ทรงคุณวุฒิ",
    );
    expect(cheerio.load(english.contentHtml, null, false)("h4").text()).toBe(
      "Dr. Weeradet Cheevapattananuwong",
    );
    expect(cheerio.load(english.contentHtml, null, false)("h5").text()).toBe(
      "Expert Committee Member",
    );
    for (const contentHtml of [thai.contentHtml, english.contentHtml]) {
      const image = cheerio.load(contentHtml, null, false)("img");
      expect(image.attr("src")).toBe(WEERADET_IMAGE_SRC);
      expect(image.attr("srcset")).toBeUndefined();
      expect(image.attr("sizes")).toBeUndefined();
    }
  });

  it("does not duplicate Chaiyut on the entrepreneur card", () => {
    const source = `
      <div class="lightweight-accordion">
        <div class="wp-block-column">
          <img src="/wp-content/uploads/2025/10/ชัยวุฒิ-ตันไชย-ผู้จัดการกลุ่มพัฒนาผู้ประกอบการและธุรกิจใหม่.jpg" alt="ชัยวุฒิ ตันไชย" />
          <h4>ชัยวุฒิ ตันไชย</h4>
          <h5>ผู้จัดการกลุ่มพัฒนาผู้ประกอบการและธุรกิจใหม่</h5>
        </div>
        <div class="wp-block-column">
          <img src="/wp-content/uploads/2024/05/IMG_2233.png" alt="" />
          <h4>–</h4>
          <h5>ผู้จัดการกลุ่มบริหารภายใน</h5>
        </div>
      </div>
    `;
    const updated = applyBoardExecutiveOverride(record({ contentHtml: source }));
    const $ = cheerio.load(updated.contentHtml, null, false);

    expect($('img[src*="IMG_2233.png"]').length).toBe(0);
    expect($('img[src*="ชัยวุฒิ"]').length).toBe(2);
  });
});
