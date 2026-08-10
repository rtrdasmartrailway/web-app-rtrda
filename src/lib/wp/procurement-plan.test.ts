import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import type { WpContentRecord } from "./types";
import { applyProcurementPlanOverride } from "./procurement-plan";

function record(overrides: Partial<WpContentRecord>): WpContentRecord {
  return {
    id: "th-page-1838",
    wpId: "1838",
    language: "th",
    kind: "page",
    path: "/จัดซื้อจัดจ้าง/แผนการจัดซื้อจัดจ้าง",
    sourceUrl: "https://www.rtrda.or.th/จัดซื้อจัดจ้าง/แผนการจัดซื้อจัดจ้าง/",
    title: "แผนการจัดซื้อจัดจ้าง",
    excerpt: "",
    contentHtml: `
      <div class="lightweight-accordion"><details>
        <summary class="lightweight-accordion-title"><h1>ปี 2569</h1></summary>
        <div class="lightweight-accordion-body">
          <table><thead><tr><th>ลำดับ</th><th>วันที่ประกาศ</th><th>โครงการ</th><th>สถานะ</th><th>เอกสาร</th></tr></thead>
            <tbody>
              <tr><td class="has-text-align-center">20</td><td>21 พฤษภาคม 2569</td><td>โครงการล่าสุด</td><td>เผยแพร่ขึ้นเว็บ</td><td><a href="/wp-content/uploads/2026/05/latest.pdf">PDF</a></td></tr>
              <tr><td class="has-text-align-center">19</td><td>21 พฤษภาคม 2569</td><td>โครงการที่สอง</td><td>เผยแพร่ขึ้นเว็บ</td><td><a href="/wp-content/uploads/2026/05/second.pdf">PDF</a></td></tr>
              <tr><td class="has-text-align-center">18</td><td>15 พฤษภาคม 2569</td><td>โครงการที่สาม</td><td>เผยแพร่ขึ้นเว็บ</td><td><a href="/wp-content/uploads/2026/05/third.pdf">PDF</a></td></tr>
            </tbody>
          </table>
        </div>
      </details></div>
      <div class="lightweight-accordion"><details>
        <summary class="lightweight-accordion-title"><h1>ปี 2568</h1></summary>
        <div class="lightweight-accordion-body">
          <table><tbody>
            <tr><td>1</td><td>1 ตุลาคม 2568</td><td>รายการเดิม</td></tr>
            <tr><td>2</td><td>2 ตุลาคม 2568</td><td>รายการเดิม 2</td></tr>
          </tbody></table>
        </div>
      </details></div>
    `,
    modified: "2025-01-01T00:00:00",
    date: "2025-01-01T00:00:00",
    parentPath: "/จัดซื้อจัดจ้าง",
    categoryIds: [],
    featuredMediaId: null,
    ...overrides,
  };
}

function firstColumnValues(html: string, accordionIndex: number): string[] {
  const $ = cheerio.load(html, null, false);
  const accordion = $(".lightweight-accordion").eq(accordionIndex);
  return accordion
    .find("tbody tr")
    .toArray()
    .map((row) => $(row).find("td").first().text().trim());
}

describe("applyProcurementPlanOverride", () => {
  it("prepends the July 2569 procurement plan rows with their PDFs", () => {
    const updated = applyProcurementPlanOverride(record({}));
    const $ = cheerio.load(updated.contentHtml, null, false);
    const firstRowCells = $(".lightweight-accordion")
      .first()
      .find("tbody tr")
      .first()
      .find("td");

    expect(firstRowCells.map((_, cell) => $(cell).text().trim()).get()).toEqual([
      "1",
      "23 กรกฎาคม 2569",
      "จ้างที่ปรึกษาโครงการส่งเสริมการแข่งขันและส่งเสริมสภาพแวดล้อมระบบรางเพื่อส่งเสริมการใช้งานระบบราง",
      "เผยแพร่ขึ้นเว็บ",
      "PDF",
    ]);
    expect(firstRowCells.last().find("a").attr("href")).toBe(
      "/wp-content/uploads/2026/07/procurement-plan-rail-competition-25690723.pdf",
    );

    const secondRowCells = $(".lightweight-accordion")
      .first()
      .find("tbody tr")
      .eq(1)
      .find("td");
    expect(secondRowCells.map((_, cell) => $(cell).text().trim()).get()).toEqual([
      "2",
      "16 กรกฎาคม 2569",
      "จ้างที่ปรึกษาศึกษาพัฒนา Algorithm เพื่อตรวจจับและแจ้งเตือนการฝ่าฝืนไม้กั้นทางรถไฟ ณ จุดตัดทางรถไฟแนวระดับ",
      "เผยแพร่ขึ้นเว็บ",
      "PDF",
    ]);
    expect(secondRowCells.last().find("a").attr("href")).toBe(
      "/wp-content/uploads/2026/07/ประกาศแผนจัดซื้อจัดจ้าง_16_07_2569.pdf?v=20260716",
    );
  });

  it("renumbers only the 2569 procurement plan table from top to bottom", () => {
    const updated = applyProcurementPlanOverride(record({}));

    expect(firstColumnValues(updated.contentHtml, 0)).toEqual(["1", "2", "3", "4", "5"]);
    expect(firstColumnValues(updated.contentHtml, 1)).toEqual(["1", "2"]);
  });

  it("preserves row order, project text, and PDF links", () => {
    const updated = applyProcurementPlanOverride(record({}));
    const $ = cheerio.load(updated.contentHtml, null, false);
    const firstExistingRowCells = $(".lightweight-accordion")
      .first()
      .find("tbody tr")
      .eq(2)
      .find("td");

    expect(firstExistingRowCells.eq(1).text().trim()).toBe("21 พฤษภาคม 2569");
    expect(firstExistingRowCells.eq(2).text().trim()).toBe("โครงการล่าสุด");
    expect(firstExistingRowCells.eq(4).find("a").attr("href")).toBe(
      "/wp-content/uploads/2026/05/latest.pdf",
    );
  });

  it("leaves unrelated pages unchanged", () => {
    const source = record({ path: "/จัดซื้อจัดจ้าง/ประกาศจัดซื้อจัดจ้าง" });

    expect(applyProcurementPlanOverride(source)).toBe(source);
  });

  it("is idempotent", () => {
    const once = applyProcurementPlanOverride(record({}));

    expect(applyProcurementPlanOverride(once)).toBe(once);
  });
});
