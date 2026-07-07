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
  it("adds the quarterly winner row to the 2569 table and renumbers top-down", () => {
    const source = record(
      "/จัดซื้อจัดจ้าง/ประกาศผลผู้ชนะการจัดซื",
      yearTableHtml(
        `<tr><td>1</td><td>7 เมษายน 2569</td><td>ไตรมาสที่ 2</td><td>เผยแพร่ขึ้นเว็บ</td><td><a href="/old.pdf">PDF</a></td></tr>`,
      ),
    );
    const updated = applyProcurementTableOverrides(source);
    const updatedRows = rows(updated.contentHtml);

    expect(updatedRows.map((row) => row[0])).toEqual(["1", "2"]);
    expect(updatedRows[0]?.[1]).toBe("7 กรกฎาคม 2569");
    expect(updatedRows[0]?.[2]).toContain("ประจำไตรมาสที่ 3");
    expect(updated.contentHtml).toContain(
      "/wp-content/uploads/2026/07/procurement-quarterly-winner-q3-2569.pdf",
    );
    expect(updated.contentHtml).not.toContain("drive.google.com");
  });

  it("adds both June monthly procurement summary rows before existing rows", () => {
    const source = record(
      "/จัดซื้อจัดจ้าง/ประกาศจดซอจดจางตามแบบส",
      yearTableHtml(
        `<tr><td>7</td><td>14 พฤษภาคม 2569</td><td>สรุปผลการดำเนินการจัดซื้อจัดจ้างในรอบเดือน เมษายน</td><td>เผยแพร่ขึ้นเว็บ</td><td><a href="/old.pdf">PDF</a></td></tr>`,
      ),
    );
    const updatedRows = rows(applyProcurementTableOverrides(source).contentHtml);

    expect(updatedRows.map((row) => row[0])).toEqual(["1", "2", "3"]);
    expect(updatedRows[0]?.[1]).toBe("3 กรกฎาคม 2569");
    expect(updatedRows[1]?.[1]).toBe("11 มิถุนายน 2569");
    expect(updatedRows[2]?.[1]).toBe("14 พฤษภาคม 2569");
    expect(applyProcurementTableOverrides(source).contentHtml).toContain(
      "/wp-content/uploads/2026/07/procurement-summary-june-2569-20260703.pdf",
    );
    expect(applyProcurementTableOverrides(source).contentHtml).toContain(
      "/wp-content/uploads/2026/07/procurement-summary-june-2569-20260611.pdf",
    );
  });

  it("adds the two July winner rows to the winner price table", () => {
    const source = record(
      "/จัดซื้อจัดจ้าง/ประกาศผลผู้ชนะการเสนอร",
      yearTableHtml(
        `<tr><td>1</td><td>22 พฤษภาคม 2569</td><td>รายการเดิม</td><td>1.00</td><td>–</td><td><a href="/old.pdf">PDF</a></td></tr>`,
      ),
    );
    const updated = applyProcurementTableOverrides(source);
    const updatedRows = rows(updated.contentHtml);

    expect(updatedRows.map((row) => row[0])).toEqual(["1", "2", "3"]);
    expect(updatedRows[0]?.[2]).toContain("จัดจ้างงานออกแบบและพิมพ์รายงานประจำปี 2568");
    expect(updatedRows[0]?.[3]).toBe("342,400.00");
    expect(updatedRows[1]?.[2]).toContain("Infrastructure Enhancement");
    expect(updatedRows[1]?.[3]).toBe("11,354,305.00");
    expect(updated.contentHtml).toContain(
      "/wp-content/uploads/2026/07/procurement-winner-annual-report-design-print-2568.pdf",
    );
    expect(updated.contentHtml).toContain(
      "/wp-content/uploads/2026/07/procurement-winner-infrastructure-enhancement-consultant.pdf",
    );
    expect(updated.contentHtml).not.toContain("drive.google.com");
  });

  it("prepends rail component standards using the existing card/button format", () => {
    const source = record(
      "/มาตรฐานระบบราง-สทร",
      `<div class="lightweight-accordion"><details><summary class="lightweight-accordion-title"><strong>มาตรฐานชิ้นส่วนระบบราง</strong></summary><div class="lightweight-accordion-body"><p>เดิม</p></div></details></div>`,
    );
    const updated = applyProcurementTableOverrides(source);
    const $ = cheerio.load(updated.contentHtml, null, false);

    expect($(".rtrda-rail-component-standards-table")).toHaveLength(0);
    expect(
      $(".rtrda-rail-component-standards-files .wp-block-column").filter((_, element) =>
        $(element).find("h6").text().includes("CT-(2002-2005)-2569"),
      ),
    ).toHaveLength(1);
    expect($(".rtrda-rail-component-standards-files img")).toHaveLength(5);
    expect($(".rtrda-rail-component-standards-files img").first().attr("src")).toContain(
      "ct-2002-2005-2569-rail-fastening-components.png",
    );
    expect(
      $(".rtrda-rail-component-standards-files .wp-block-button__link").first().text(),
    ).toBe("อ่านเพิ่มเติม");
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
});
