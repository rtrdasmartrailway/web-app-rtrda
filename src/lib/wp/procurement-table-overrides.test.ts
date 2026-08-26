import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { applyProcurementTableOverrides } from "./procurement-table-overrides";
import type { WpContentRecord } from "./types";

function record(path: string, contentHtml: string): WpContentRecord {
  return {
    id: "test-record",
    wpId: "test-record",
    language: "th",
    kind: "page",
    path,
    sourceUrl: `https://test.rtrda.or.th${path}`,
    title: "test",
    excerpt: "",
    contentHtml,
    modified: "2026-07-07T00:00:00.000Z",
    date: "2026-07-07T00:00:00.000Z",
    parentPath: "/จัดซื้อจัดจ้าง",
    categoryIds: [],
    featuredMediaId: null,
    authorId: null,
  };
}

function yearTableHtml(rows: string): string {
  return `
    <div class="lightweight-accordion"><details>
      <summary class="lightweight-accordion-title"><strong>ปี 2569</strong></summary>
      <div class="lightweight-accordion-body"><table><tbody>${rows}</tbody></table></div>
    </details></div>
    <div class="lightweight-accordion"><details>
      <summary class="lightweight-accordion-title"><strong>ปี 2568</strong></summary>
      <div class="lightweight-accordion-body"><table><tbody><tr><td>1</td><td>เดิม 2568</td></tr></tbody></table></div>
    </details></div>
  `;
}

function rows(html: string): string[][] {
  const $ = cheerio.load(html, null, false);
  return $(".lightweight-accordion")
    .first()
    .find("tbody tr")
    .toArray()
    .map((row) =>
      $(row)
        .find("td")
        .toArray()
        .map((cell) => $(cell).text().replace(/\s+/g, " ").trim()),
    );
}

describe("applyProcurementTableOverrides", () => {
  it("adds the quarterly winner row, fixes the title, and numbers bottom-up", () => {
    const source = record(
      "/จัดซื้อจัดจ้าง/ประกาศผลผู้ชนะการจัดซื",
      yearTableHtml(
        `<tr><td>1</td><td>7 เมษายน 2569</td><td>ไตรมาสที่ 2</td><td>เผยแพร่ขึ้นเว็บ</td><td><a href="/old.pdf">PDF</a></td></tr>`,
      ),
    );
    const updated = applyProcurementTableOverrides(source);
    const updatedRows = rows(updated.contentHtml);

    expect(updatedRows.map((row) => row[0])).toEqual(["2", "1"]);
    expect(updatedRows[0]?.[1]).toBe("7 กรกฎาคม 2569");
    expect(updatedRows[0]?.[2]).toContain("ประจำไตรมาสที่ 3");
    expect(updatedRows[0]?.[2]).toContain("เดือน มิถุนายน 2569");
    expect(updatedRows[0]?.[2]).not.toContain("เดือน มีนาคม 2569");
    expect(updatedRows[1]?.[2]).toContain("ไตรมาสที่ 2");
    expect(updated.contentHtml).toContain(
      "/wp-content/uploads/2026/07/procurement-quarterly-winner-q3-2569.pdf",
    );
    expect(updated.contentHtml).not.toContain("drive.google.com");
  });

  it("adds the July and June monthly procurement summary rows before existing rows", () => {
    const source = record(
      "/จัดซื้อจัดจ้าง/ประกาศจดซอจดจางตามแบบส",
      yearTableHtml(
        `<tr><td>7</td><td>14 พฤษภาคม 2569</td><td>สรุปผลการดำเนินการจัดซื้อจัดจ้างในรอบเดือน เมษายน</td><td>เผยแพร่ขึ้นเว็บ</td><td><a href="/old.pdf">PDF</a></td></tr>`,
      ),
    );
    const updatedRows = rows(applyProcurementTableOverrides(source).contentHtml);

    expect(updatedRows.map((row) => row[0])).toEqual(["1", "2", "3", "4"]);
    expect(updatedRows[0]?.[1]).toBe("5 สิงหาคม 2569");
    expect(updatedRows[0]?.[2]).toBe(
      "สรุปผลการดำเนินการจัดซื้อจัดจ้างในรอบเดือน กรกฎาคม 2569",
    );
    expect(updatedRows[1]?.[1]).toBe("3 กรกฎาคม 2569");
    expect(updatedRows[2]?.[1]).toBe("11 มิถุนายน 2569");
    expect(updatedRows[3]?.[1]).toBe("14 พฤษภาคม 2569");
    expect(applyProcurementTableOverrides(source).contentHtml).toContain(
      "/wp-content/uploads/2026/08/procurement-summary-july-2569-20260805.pdf",
    );
    expect(applyProcurementTableOverrides(source).contentHtml).toContain(
      "/wp-content/uploads/2026/07/procurement-summary-june-2569-20260703.pdf",
    );
    expect(applyProcurementTableOverrides(source).contentHtml).toContain(
      "/wp-content/uploads/2026/07/procurement-summary-june-2569-20260611.pdf",
    );
  });

  it("adds the August and July winner rows to the winner price table and numbers bottom-up", () => {
    const source = record(
      "/จัดซื้อจัดจ้าง/ประกาศผลผู้ชนะการเสนอร",
      yearTableHtml(
        `<tr><td>1</td><td>22 พฤษภาคม 2569</td><td>รายการเดิม</td><td>1.00</td><td>–</td><td><a href="/old.pdf">PDF</a></td></tr>`,
      ),
    );
    const updated = applyProcurementTableOverrides(source);
    const updatedRows = rows(updated.contentHtml);

    expect(updatedRows.map((row) => row[0])).toEqual([
      "9",
      "8",
      "7",
      "6",
      "5",
      "4",
      "3",
      "2",
      "1",
    ]);
    expect(updatedRows[0]?.[1]).toBe("19 สิงหาคม 2569");
    expect(updatedRows[0]?.[2]).toContain("งานจ้างที่ปรึกษาโครงการส่งเสริมการแข่งขัน");
    expect(updatedRows[0]?.[3]).toBe("900,000.00");
    expect(updatedRows[1]?.[1]).toBe("21 กรกฎาคม 2569");
    expect(updatedRows[1]?.[2]).toContain("Siamese Train");
    expect(updatedRows[1]?.[3]).toBe("21,000,000.00");
    expect(updatedRows[2]?.[1]).toBe("17 กรกฎาคม 2569");
    expect(updatedRows[2]?.[2]).toContain("International Engineering Expo 2026");
    expect(updatedRows[2]?.[3]).toBe("160,500.00");
    expect(updatedRows[3]?.[2]).toContain("ทรัพย์สินทางปัญญาของสถาบัน");
    expect(updatedRows[3]?.[3]).toBe("4,300,000.00");
    expect(updatedRows[4]?.[2]).toContain("จัดทำของที่ระลึก");
    expect(updatedRows[4]?.[3]).toBe("249,738.00");
    expect(updatedRows[5]?.[2]).toContain("National Rolling Stock Company");
    expect(updatedRows[5]?.[3]).toBe("7,950,000.00");
    expect(updatedRows[6]?.[2]).toContain("จัดจ้างงานออกแบบและพิมพ์รายงานประจำปี 2568");
    expect(updatedRows[6]?.[3]).toBe("342,400.00");
    expect(updatedRows[7]?.[2]).toContain("Infrastructure Enhancement");
    expect(updatedRows[7]?.[3]).toBe("11,354,305.00");
    expect(updated.contentHtml).toContain(
      "/wp-content/uploads/2026/08/procurement-winner-rail-competition-consultant-25690819.pdf",
    );
    expect(updated.contentHtml).toContain(
      "/wp-content/uploads/2026/07/procurement-winner-consultant-ip-management-25690708.pdf",
    );
    expect(updated.contentHtml).toContain(
      "/wp-content/uploads/2026/07/procurement-winner-souvenir-design-25690708.pdf",
    );
    expect(updated.contentHtml).toContain(
      "/wp-content/uploads/2026/07/procurement-winner-infrastructure-enhancement-consultant.pdf",
    );
    expect(updated.contentHtml).toContain(
      "/wp-content/uploads/2026/07/ประกาศผู้ชนะ_17_07_2569.pdf?v=20260717",
    );
    expect(updated.contentHtml).toContain(
      "/wp-content/uploads/2026/07/ประกาศผู้ชนะโครงการพัฒนาตู้รถไฟท่องเที่ยว_21_07_2569.pdf?v=20260721",
    );
    expect(updated.contentHtml).not.toContain("drive.google.com");
  });

  it("keeps the 10 July winner row above the older July winner rows", () => {
    const source = record(
      "/จัดซื้อจัดจ้าง/ประกาศผลผู้ชนะการเสนอร",
      yearTableHtml(
        `<tr><td>1</td><td>10 กรกฎาคม 2569</td><td>เรื่อง ประกาศผู้ชนะการเสนอราคา จ้างเหมาบริการจัดงานพิธีทำบุญวันสถาปนา สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) ครบรอบ 5 ปี โดยวิธีเฉพาะเจาะจง</td><td>250,000.00</td><td>–</td><td><a href="/wp-content/uploads/2026/07/procurement-winner-rtrda-5th-anniversary-25690710.pdf">PDF</a></td></tr><tr><td>2</td><td>25 มิถุนายน 2569</td><td>รายการเดิม</td><td>1.00</td><td>–</td><td><a href="/old.pdf">PDF</a></td></tr>`,
      ),
    );
    const updatedRows = rows(applyProcurementTableOverrides(source).contentHtml);

    expect(updatedRows.map((row) => row[0])).toEqual([
      "10",
      "9",
      "8",
      "7",
      "6",
      "5",
      "4",
      "3",
      "2",
      "1",
    ]);
    expect(updatedRows[0]?.[1]).toBe("19 สิงหาคม 2569");
    expect(updatedRows[1]?.[1]).toBe("21 กรกฎาคม 2569");
    expect(updatedRows[2]?.[1]).toBe("17 กรกฎาคม 2569");
    expect(updatedRows[3]?.[1]).toBe("10 กรกฎาคม 2569");
    expect(updatedRows[3]?.[2]).toContain("จ้างเหมาบริการจัดงานพิธีทำบุญวันสถาปนา");
    expect(updatedRows.slice(4, 7).map((row) => row[1])).toEqual([
      "8 กรกฎาคม 2569",
      "8 กรกฎาคม 2569",
      "8 กรกฎาคม 2569",
    ]);
    expect(updatedRows[7]?.[1]).toBe("7 กรกฎาคม 2569");
  });

  it("prepends rail component standards using the shared rail card format", () => {
    const source = record(
      "/มาตรฐานระบบราง-สทร",
      `<div class="lightweight-accordion"><details><summary class="lightweight-accordion-title"><strong>มาตรฐานชิ้นส่วนระบบราง</strong></summary><div class="lightweight-accordion-body"><p>เดิม</p></div></details></div>`,
    );
    const updated = applyProcurementTableOverrides(source);
    const $ = cheerio.load(updated.contentHtml, null, false);

    expect($(".rtrda-rail-component-standards-table")).toHaveLength(0);
    expect($(".rtrda-rail-component-standards-files").hasClass("wp-block-columns")).toBe(
      true,
    );
    expect($(".rtrda-rail-component-card-grid")).toHaveLength(0);
    expect($(".rtrda-rail-component-card")).toHaveLength(5);
    expect($(".rtrda-rail-component-standards-files").attr("style")).toBeUndefined();
    expect($(".rtrda-rail-component-card").first().attr("style")).toBeUndefined();
    expect($(".rtrda-rail-component-standards-files > .wp-block-spacer")).toHaveLength(0);
    expect($(".rtrda-rail-component-standards-files img")).toHaveLength(5);
    expect($(".rtrda-rail-component-standards-files img").first().attr("src")).toContain(
      "ct-2002-2005-2569-rail-fastening-components.png",
    );
    expect($(".rtrda-rail-component-standards-files h6").first().text()).toBe(
      "ชุดมาตรฐานอุปกรณ์ยึดเหนี่ยวราง",
    );
    expect(
      $(".rtrda-rail-component-standards-files .wp-block-button__link").first().text(),
    ).toBe("อ่านเพิ่มเติม");
    expect(
      $(".rtrda-rail-component-standards-files .simple-download-counter-link")
        .first()
        .attr("data-pdf-reader-ignore"),
    ).toBe("true");
    expect(
      $(".rtrda-rail-component-standards-files .simple-download-counter-link")
        .first()
        .text(),
    ).toBe("ดาวน์โหลดไฟล์");
    const componentIndex = updated.contentHtml.indexOf(
      "rtrda-rail-component-standards-files",
    );
    const originalIndex = updated.contentHtml.indexOf("เดิม");
    expect(componentIndex).toBeGreaterThan(-1);
    expect(originalIndex).toBeGreaterThan(componentIndex);
    expect(updated.contentHtml).toContain(
      "/wp-content/uploads/standards/rail-components/ct-2002-2005-2569-rail-fastening-components.pdf",
    );
    expect(updated.contentHtml).not.toContain("drive.google.com");
  });

  it("replaces incomplete welding and other standard cards with complete document cards", () => {
    const source = record(
      "/มาตรฐานระบบราง-สทร",
      `<div class="lightweight-accordion"><details open><summary class="lightweight-accordion-title"><strong>มาตรฐานงานเชื่อม</strong></summary><div class="lightweight-accordion-body"><p>–</p></div></details></div><div class="lightweight-accordion"><details open><summary class="lightweight-accordion-title"><strong>อื่นๆ</strong></summary><div class="lightweight-accordion-body"><p>–</p></div></details></div>`,
    );
    const updated = applyProcurementTableOverrides(source);
    const $ = cheerio.load(updated.contentHtml, null, false);
    const welding = $(".rtrda-rail-welding-files");
    const other = $(".rtrda-other-rail-standard-files");

    expect(welding.hasClass("wp-block-columns")).toBe(true);
    expect(welding.find(".wp-block-column")).toHaveLength(3);
    expect(
      welding
        .find("h6")
        .toArray()
        .map((heading) => $(heading).text()),
    ).toEqual([
      "มาตรฐานแนะนำการเชื่อมซ่อมผิวหัวรางด้วยการเชื่อมอาร์ก",
      "มาตรฐานการทดสอบเพื่อรับรองการเชื่อมซ่อมผิวหัวรางด้วยการเชื่อมอาร์ก",
      "ชุดมาตรฐานการทดสอบโดยไม่ทำลายบนรอยเชื่อมรางรถไฟ",
    ]);
    expect(welding.text()).not.toContain("สทร-RS-6001-2568");
    expect(welding.text()).not.toContain("สทร-RS-6002-2568");
    expect($("details[open]")).toHaveLength(0);
    expect(other.find(".wp-block-column")).toHaveLength(1);
    expect(other.hasClass("rtrda-rail-standards-files--single")).toBe(true);
    expect(other.find("h6").text()).toBe("รายงานการพัฒนามาตรฐานระบบราง");
    expect(
      other
        .find("a")
        .filter((_, link) => $(link).text() === "อ่านเพิ่มเติม")
        .attr("href"),
    ).toBe("/sdc_download/5544");
    expect(updated.contentHtml).not.toContain("<p>–</p>");
  });

  it("adds development plan and standards compilation cards before high-speed rail", () => {
    const source = record(
      "/มาตรฐานระบบราง-สทร",
      `<div class="lightweight-accordion"><details><summary class="lightweight-accordion-title"><strong>มาตรฐานโครงการรถไฟความเร็วสูง</strong></summary><div class="lightweight-accordion-body"><p>เดิม</p></div></details></div>`,
    );
    const updated = applyProcurementTableOverrides(source);
    const $ = cheerio.load(updated.contentHtml, null, false);
    const accordions = $(".lightweight-accordion");
    const developmentPlan = accordions.filter((_, element) =>
      $(element).find("summary").text().includes("แผนพัฒนามาตรฐานระบบขนส่งทางราง"),
    );
    const compilation = accordions.filter((_, element) =>
      $(element).find("summary").text().includes("ประมวลมาตรฐานระบบขนส่งทางราง"),
    );

    expect(
      developmentPlan.find(".rtrda-rail-standards-files .wp-block-column"),
    ).toHaveLength(1);
    expect(developmentPlan.find(".rtrda-rail-standards-files--single")).toHaveLength(1);
    expect(developmentPlan.find("h6").text()).toBe(
      "แผนพัฒนามาตรฐานระบบขนส่งทางรางของ สทร.",
    );
    expect(compilation.find(".rtrda-rail-standards-files .wp-block-column")).toHaveLength(
      6,
    );
    expect(compilation.find(".rtrda-rail-standards-files--single")).toHaveLength(0);
    expect(
      compilation
        .find("h6")
        .toArray()
        .map((heading) => $(heading).text()),
    ).toEqual([
      "ประมวลมาตรฐานระบบขนส่งทางรางด้านระบบไฟฟ้า",
      "ประมวลมาตรฐานระบบขนส่งทางรางด้านสิ่งแวดล้อมและพลังงาน",
      "ประมวลมาตรฐานระบบขนส่งทางรางด้านระบบการเดินรถและซ่อมบำรุง",
      "ประมวลมาตรฐานระบบขนส่งทางรางด้านระบบอาณัติสัญญาณและการสื่อสาร",
      "ประมวลมาตรฐานระบบขนส่งทางรางด้านความปลอดภัยและความมั่นคง",
      "ประมวลมาตรฐานระบบขนส่งทางรางด้านล้อเลื่อน",
    ]);
    expect(compilation.find("img").first().attr("src")).toBe(
      "/wp-content/uploads/2026/07/rtrda-rail-standards-electrical-systems.png",
    );
    expect(updated.contentHtml).toContain(
      "/wp-content/uploads/2026/07/rtrda-rail-standards-development-plan.pdf",
    );
    expect(updated.contentHtml).toContain(
      "/wp-content/uploads/2026/07/rtrda-rail-standards-rolling-stock.pdf",
    );
    expect(updated.contentHtml).toContain("ดาวน์โหลดไฟล์");
    expect(updated.contentHtml.indexOf("แผนพัฒนามาตรฐานระบบขนส่งทางราง")).toBeLessThan(
      updated.contentHtml.indexOf("มาตรฐานโครงการรถไฟความเร็วสูง"),
    );
  });

  it("keeps the 2569 cancellation/winner table empty", () => {
    const source = record(
      "/จัดซื้อจัดจ้าง/ยกเลิกประกาศเชิญชวน-ผู้",
      `<div class="lightweight-accordion"><details><summary><h1><strong>ปี 2568</strong></h1></summary><div class="lightweight-accordion-body"><figure class="wp-block-table"><table><thead><tr><th>ลำดับ</th><th>วันที่ประกาศ</th><th>โครงการ</th><th>สถานะ</th><th>เอกสาร</th></tr></thead><tbody><tr><td>1</td><td>13 สิงหาคม 2568</td><td>รายการเดิม</td><td>เผยแพร่ขึ้นเว็บ</td><td><a href="/old.pdf">PDF</a></td></tr></tbody></table></figure></div></details></div>`,
    );
    const updated = applyProcurementTableOverrides(source);
    const $ = cheerio.load(updated.contentHtml, null, false);
    const firstAccordion = $(".lightweight-accordion").first();

    expect(firstAccordion.find("summary").text()).toContain("ปี 2569");
    expect(firstAccordion.find("tbody tr")).toHaveLength(0);
    expect(updated.contentHtml).not.toContain(
      "procurement-cancel-winner-consultant-ip-management-25690708.pdf",
    );
  });

  it("adds the National Rolling Stock Company winner row for 2569", () => {
    const source = record(
      "/จัดซื้อจัดจ้าง/ประกาศผลผู้ชนะการเสนอร",
      `<div class="lightweight-accordion"><details><summary><h1><strong>ปี 2569</strong></h1></summary><div class="lightweight-accordion-body"><figure class="wp-block-table"><table><thead><tr><th>ลำดับ</th><th>วันที่ประกาศ</th><th>โครงการ</th><th>งบประมาณ</th><th>สถานะ</th><th>เอกสาร</th></tr></thead><tbody></tbody></table></figure></div></details></div>`,
    );
    const updated = applyProcurementTableOverrides(source);
    const $ = cheerio.load(updated.contentHtml, null, false);
    const row = $("tbody tr")
      .filter((_, element) =>
        $(element).text().includes("National Rolling Stock Company"),
      )
      .first();

    expect(row.find("td").first().text()).toBe("3");
    expect(row.text()).toContain("8 กรกฎาคม 2569");
    expect(row.text()).toContain("National Rolling Stock Company");
    expect(row.text()).toContain("7,950,000.00");
    expect(row.find("a").attr("href")).toBe(
      "/wp-content/uploads/2026/07/procurement-winner-national-rolling-stock-company-25690708.pdf",
    );
  });
});
