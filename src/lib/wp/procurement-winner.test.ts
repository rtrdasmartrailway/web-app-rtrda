import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import type { WpContentRecord } from "./types";
import { applyProcurementWinnerOverride } from "./procurement-winner";

function record(overrides: Partial<WpContentRecord>): WpContentRecord {
  return {
    id: "th-page-1847",
    wpId: "1847",
    language: "th",
    kind: "page",
    path: "/จัดซื้อจัดจ้าง/ประกาศผลผู้ชนะการเสนอร",
    sourceUrl: "https://www.rtrda.or.th/จัดซื้อจัดจ้าง/ประกาศผลผู้ชนะการเสนอร/",
    title: "ประกาศผลผู้ชนะการเสนอราคา/เปลี่ยนแปลง",
    excerpt: "",
    contentHtml: `
      <div class="lightweight-accordion"><details>
        <summary class="lightweight-accordion-title"><h1>ปี 2569</h1></summary>
        <div class="lightweight-accordion-body">
          <table><thead><tr><th>ลำดับ</th><th>วันที่ประกาศ</th><th>โครงการ/กิจกรรม</th><th>งบประมาณโครงการ (บาท)</th><th>เลขที่เอกสาร/ประกาศ</th><th>เอกสาร</th></tr></thead>
            <tbody>
              <tr><td class="has-text-align-center">1</td><td>22 พฤษภาคม 2569</td><td>รายการเดิมแรก</td><td>213,893.00</td><td>–</td><td><a href="/old.pdf">PDF</a></td></tr>
              <tr><td class="has-text-align-center">2</td><td>6 พฤษภาคม 2569</td><td>รายการเดิมสอง</td><td>7,999,000.00</td><td>–</td><td><a href="/old2.pdf">PDF</a></td></tr>
            </tbody>
          </table>
        </div>
      </details></div>
      <div class="lightweight-accordion"><details>
        <summary class="lightweight-accordion-title"><h1>ปี 2568</h1></summary>
        <div class="lightweight-accordion-body">
          <table><tbody>
            <tr><td>1</td><td>1 ตุลาคม 2568</td><td>รายการเดิมปีอื่น</td></tr>
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

function rows(html: string, accordionIndex: number): string[][] {
  const $ = cheerio.load(html, null, false);
  return $(".lightweight-accordion")
    .eq(accordionIndex)
    .find("tbody tr")
    .toArray()
    .map((row) =>
      $(row)
        .find("td")
        .toArray()
        .map((cell) => $(cell).text().replace(/\s+/g, " ").trim()),
    );
}

describe("applyProcurementWinnerOverride", () => {
  it("prepends the new 2569 winner row and renumbers existing rows", () => {
    const updated = applyProcurementWinnerOverride(record({}));
    const year2026Rows = rows(updated.contentHtml, 0);

    expect(year2026Rows).toHaveLength(3);
    expect(year2026Rows[0]).toEqual([
      "1",
      "25 มิถุนายน 2569",
      "เรื่อง ประกาศผู้ชนะการเสนอราคา จัดซื้อซอฟต์แวร์การออกแบบใช้คอมพิวเตอร์ช่วย (CAD Computer Aided Design) ด้วยโปรแกรม CATIA พร้อมติดตั้ง โดยวิธีประกวดราคาอิเล็กทรอนิกส์ (e-bidding)",
      "1,342,927.58",
      "–",
      "PDF",
    ]);
    expect(year2026Rows.map((row) => row[0])).toEqual(["1", "2", "3"]);
    expect(year2026Rows[1]?.[2]).toBe("รายการเดิมแรก");
  });

  it("links the new row to the supplied PDF", () => {
    const updated = applyProcurementWinnerOverride(record({}));
    const $ = cheerio.load(updated.contentHtml, null, false);
    const firstRowLink = $(".lightweight-accordion")
      .first()
      .find("tbody tr")
      .first()
      .find("a");

    expect(firstRowLink.text().trim()).toBe("PDF");
    expect(firstRowLink.attr("href")).toBe(
      "/wp-content/uploads/2026/06/ประกาศแผนแพร่แผนการจัดซื้อจัดจ้าง_0001.pdf",
    );
  });

  it("does not modify other year tables", () => {
    const updated = applyProcurementWinnerOverride(record({}));

    expect(rows(updated.contentHtml, 1)).toEqual([
      ["1", "1 ตุลาคม 2568", "รายการเดิมปีอื่น"],
    ]);
  });

  it("is idempotent", () => {
    const once = applyProcurementWinnerOverride(record({}));
    const twice = applyProcurementWinnerOverride(once);

    expect(twice).toBe(once);
  });

  it("leaves unrelated pages unchanged", () => {
    const source = record({ path: "/จัดซื้อจัดจ้าง/ประกาศจัดซื้อจัดจ้าง" });

    expect(applyProcurementWinnerOverride(source)).toBe(source);
  });
});
