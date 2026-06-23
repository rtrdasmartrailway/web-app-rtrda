import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import type { WpContentRecord } from "./types";
import {
  applyItaHeadingsOverride,
  ITA_HEADING_REPLACEMENTS,
} from "./ita-headings-override";

function record(overrides: Partial<WpContentRecord>): WpContentRecord {
  return {
    id: overrides.id ?? "th-page-9999",
    wpId: overrides.wpId ?? 9999,
    language: overrides.language ?? "th",
    kind: overrides.kind ?? "page",
    path: overrides.path ?? "/x",
    sourceUrl: overrides.sourceUrl ?? "https://www.rtrda.or.th/x",
    title: overrides.title ?? "Untitled",
    excerpt: overrides.excerpt ?? "",
    contentHtml: overrides.contentHtml ?? "",
    modified: overrides.modified ?? "",
    date: overrides.date ?? "",
    parentPath: overrides.parentPath ?? null,
    categoryIds: [],
    featuredMediaId: null,
  };
}

function fixtureContent(): string {
  const oldHeadings = [
    "O3 ข้อมูลการติดต่อ",
    "O10 E–Service",
    "O11 ข้อมูลสถิติการให้บริการ",
    "O12 รายการการจัดซื้อจัดจ้างหรือการจัดหาพัสดุ และความก้าวหน้าการจัดซื้อจัดจ้างหรือการจัดหาพัสดุ",
    "O13 รายงานผลการจัดซื้อจัดจ้างหรือการจัดหาพัสดุประจำปี พ.ศ. 2568",
    "O14 แผนการบริหารและพัฒนาทรัพยากรบุคคลประจำปีงบประมาณ พ.ศ. 2569",
    "O15 รายงานผลการบริหารและพัฒนาทรัพยากรบุคคลประจำปี พ.ศ. 2568",
    "O16 ประมวลจริยธรรมและการขับเคลื่อนจริยธรรม",
    "O17 แนวปฏิบัติการจัดการเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ",
    "O18 ช่องทางแจ้งเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ",
    "O19 ข้อมูลสถิติเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ ประจำปี พ.ศ. 2568",
    "O20 การเปิดโอกาสให้เกิดการมีส่วนร่วม",
    "O21 ประกาศเจตนารมณ์และการสร้างวัฒนธรรม ตามนโยบาย No Gift Policy จากการปฏิบัติหน้าที่",
    "O22 รายงานการรับทรัพย์สินหรือประโยชน์อื่นใดโดยธรรมจรรยา",
    "O23 การประเมินความเสี่ยงที่อาจเกิดการให้หรือรับสินบนจากการดำเนินงานตามภารกิจของหน่วยงานประจำปี พ.ศ. 2569",
    "O24 รายงานผลการดำเนินการเพื่อจัดการความเสี่ยงการทุจริตและประพฤติมิชอบประจำปี พ.ศ. 2568",
    "O25 แผนปฏิบัติการป้องกันปราบปรามการทุจริตและประพฤติมิชอบ และส่งเสริมคุณธรรมจริยธรรมของกระทรวงคมนาคม ประจำปีงบประมาณ พ.ศ. 2569",
    "O26 รายงานผลการดำเนินงานตามแผนปฏิบัติการป้องกันปราบปรามการทุจริตและประพฤติมิชอบ และส่งเสริมคุณธรรมจริยธรรมของกระทรวงคมนาคม ประจำปีงบประมาณ พ.ศ. 2568",
  ];
  return [
    '<div class="lightweight-accordion-body">',
    "<h2>การประเมิน ITA ปี 2569</h2>",
    oldHeadings.map((h) => `<p><strong>${h}</strong></p>`).join("\n"),
    "</div>",
    '<div class="lightweight-accordion-body">',
    "<h2>การประเมิน ITA ปี 2568</h2>",
    oldHeadings.map((h) => `<p><strong>${h}</strong></p>`).join("\n"),
    "</div>",
  ].join("\n");
}

describe("applyItaHeadingsOverride", () => {
  it("returns the same reference for unrelated records", () => {
    const r = record({ id: "th-page-1", contentHtml: "<p>x</p>" });
    expect(applyItaHeadingsOverride(r)).toBe(r);
  });

  it("returns the same reference for the English mirror", () => {
    const r = record({
      id: "en-page-4837",
      language: "en",
      contentHtml:
        "<div class='lightweight-accordion-body'><h2>Old</h2>O3 ข้อมูลการติดต่อ</div>",
    });
    expect(applyItaHeadingsOverride(r)).toBe(r);
  });

  it("rewrites every Thai heading inside the 2569 section only", () => {
    const r = record({ id: "th-page-4837", contentHtml: fixtureContent() });
    const updated = applyItaHeadingsOverride(r);
    expect(updated).not.toBe(r);
    expect(updated.contentHtml).not.toBe(r.contentHtml);

    const $ = cheerio.load(updated.contentHtml, null, false);
    const sections = $("div.lightweight-accordion-body").toArray();
    expect(sections.length).toBe(2);

    const section2024 = $(sections[0]);
    const section2023 = $(sections[1]);

    for (const [oldHeading, newHeading] of ITA_HEADING_REPLACEMENTS) {
      // 2569 section: must contain the new heading, and must NOT contain the
      // old one. The MOPH MOIT 2569 strings are disjoint from the old
      // headings, so a plain substring check is sufficient.
      expect(section2024.text()).toContain(newHeading);
      expect(section2024.text()).not.toContain(oldHeading);

      // 2568 section: must still contain the old heading, and must NOT
      // contain the new heading.
      expect(section2023.text()).toContain(oldHeading);
      expect(section2023.text()).not.toContain(newHeading);
    }
  });

  it("is idempotent (running twice does not duplicate)", () => {
    const r = record({ id: "th-page-4837", contentHtml: fixtureContent() });
    const once = applyItaHeadingsOverride(r);
    const twice = applyItaHeadingsOverride(once);
    expect(twice).toBe(once);
  });

  it("rewrites the real th-page-4837 JSON: 2569 section changes, 2568 section is intact", async () => {
    const manifest = JSON.parse(await readFile("src/data/wp-content.json", "utf8")) as {
      records: WpContentRecord[];
    };
    const r = manifest.records.find((x) => x.id === "th-page-4837");
    expect(r).toBeDefined();
    if (!r) return;

    const before2569 = cheerio.load(r.contentHtml, null, false).text();
    expect(before2569).toContain("O3 ข้อมูลการติดต่อ");
    expect(before2569).toContain("O10 E–Service");
    expect(before2569).toContain("O11 ข้อมูลสถิติการให้บริการ");
    expect(before2569).toContain(
      "O13 รายงานผลการจัดซื้อจัดจ้างหรือการจัดหาพัสดุประจำปี พ.ศ. 2568",
    );

    const updated = applyItaHeadingsOverride(r);
    const $after = cheerio.load(updated.contentHtml, null, false);
    const sections = $after("div.lightweight-accordion-body").toArray();
    expect(sections.length).toBe(2);

    const section2024 = $after(sections[0]).text();
    const section2023 = $after(sections[1]).text();

    // 2569: every old heading is gone, every new MOPH MOIT 2569 heading is
    // present. 2568 must NOT contain any of the new MOPH MOIT 2569 strings
    // (which would indicate the override leaked across sections). For the
    // O-markers that share text between 2569 and 2568, also assert the
    // original text is still present in 2568.
    const sharedBetween2569And2568 = new Set([
      "O10 E–Service",
      "O11 ข้อมูลสถิติการให้บริการ",
      "O12 รายการการจัดซื้อจัดจ้างหรือการจัดหาพัสดุ และความก้าวหน้าการจัดซื้อจัดจ้างหรือการจัดหาพัสดุ",
      "O16 ประมวลจริยธรรมและการขับเคลื่อนจริยธรรม",
      "O17 แนวปฏิบัติการจัดการเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ",
      "O20 การเปิดโอกาสให้เกิดการมีส่วนร่วม",
      "O22 รายงานการรับทรัพย์สินหรือประโยชน์อื่นใดโดยธรรมจรรยา",
    ]);
    for (const [oldHeading, newHeading] of ITA_HEADING_REPLACEMENTS) {
      expect(section2024).not.toContain(oldHeading);
      expect(section2024).toContain(newHeading);
      expect(section2023).not.toContain(newHeading);
      if (sharedBetween2569And2568.has(oldHeading)) {
        expect(section2023).toContain(oldHeading);
      }
    }

    // 2568 year-2567 variants must be preserved (they only exist in 2568).
    expect(section2023).toContain(
      "O13 รายงานผลการจัดซื้อจัดจ้างหรือการจัดหาพัสดุประจำปี พ.ศ. 2567",
    );
    expect(section2023).toContain(
      "O15 รายงานผลการบริหารและพัฒนาทรัพยากรบุคคลประจำปี พ.ศ. 2567",
    );
    expect(section2023).toContain(
      "O19 ข้อมูลสถิติเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ ประจำปี พ.ศ. 2567",
    );

    // O20 is now in the replacement list — 2569 should have the new NO GIFT
    // POLICY text, and 2568 should still have the original "การเปิดโอกาส"
    // heading (scoped override, 2568 is untouched).
    expect(section2024).toContain(
      "O20 การขับเคลื่อนนโยบาย NO GIFT POLICY จากการปฏิบัติหน้าที่และการเสริมสร้างความรู้เกี่ยวกับหลักเกณฑ์การรับทรัพย์สินหรือประโยชน์อื่นใดโดยธรรมจรรยาของเจ้าพนักงานของรัฐ",
    );
    expect(section2024).not.toContain("O20 การเปิดโอกาสให้เกิดการมีส่วนร่วม");
    expect(section2023).toContain("O20 การเปิดโอกาสให้เกิดการมีส่วนร่วม");
  });
});
