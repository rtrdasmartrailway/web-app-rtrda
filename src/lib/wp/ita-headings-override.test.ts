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
    "O1 โครงสร้างและอำนาจหน้าที่",
    "O3 ข้อมูลการติดต่อ",
    "O4 ข่าวประชาสัมพันธ์",
    "O8 คู่มือหรือแนวทางการปฏิบัติงานของเจ้าหน้าที่",
    "O9 คู่มือหรือแนวทางการขอรับบริการสำหรับผู้รับบริการหรือผู้มาติดต่อ",
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
    expect(before2569).toContain("O1 โครงสร้างและอำนาจหน้าที่");
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

    const section2024Node = $after(sections[0]);
    const section2024 = section2024Node.text();
    const section2024Html = section2024Node.html() ?? "";
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

    expect(section2024).toContain("o15 ประมวลจริยธรรม");
    expect(section2024).toContain("รายงานข้อมูลสถิติเรื่องร้องเรียนการทุจร (Excel)");
    expect(section2024).toContain("การประเมินความเสี่ยงทุจริต_5_ขั้นตอน");
    expect(section2024).toContain(
      "ด้านที่ 2 .รายงานผลด้านการใช้ตำแหน่งหน้าที่ราชการเพื่อช่วยเหลืออำนวยความสะดวก",
    );
    expect(section2024).toContain("ด้านที่ 4.รายงานผล งานบุคคล ปี 2568");
    expect(section2024).toContain(
      "สทร. จัดประชุมเทคนิคพิจารณ์ ร่าง มาตรฐานหมอนคอนกรีตและอุปกรณ์ยึดเหนี่ยวราง ครั้งที่ 1/2568 มุ่งยกระดับคุณภาพและความปลอดภัยของระบบรางไทยสู่ระดับสากล",
    );
    expect(section2024).toContain(
      "ข้อมูลสถิติการขอรับบริการผ่านช่องทางออนไลน์(E-service)",
    );
    expect(section2024).not.toContain("– Analytics");
    expect(section2024).not.toContain("Messenger Live Chat");
    expect(section2023).toContain("Messenger Live Chat");
    const linksFor = (
      marker: string,
    ): Array<{ title: string; href: string | undefined }> => {
      const heading = section2024Node
        .find("p")
        .toArray()
        .find((element) => $after(element).text().trim().startsWith(`${marker} `));
      expect(heading).toBeDefined();
      if (!heading) {
        return [];
      }

      const links: Array<{ title: string; href: string | undefined }> = [];
      let next = $after(heading).next();
      while (next.length) {
        if (next.is("p") && /^O\d+\b/.test(next.text().trim())) {
          break;
        }
        if (next.is("h1, h2, h3, h4, h5, h6")) {
          break;
        }
        const link = next.find("a").first();
        if (link.length) {
          links.push({ title: link.text().trim(), href: link.attr("href") });
        }
        next = next.next();
      }
      return links;
    };

    expect(linksFor("O4")).toEqual([
      {
        title:
          "– สทร. เดินหน้ายกระดับองค์กรโปร่งใส จัดโครงการพัฒนาและเพิ่มประสิทธิภาพการประเมิน ITA ประจำปี 2569",
        href: "/สทร-เดินหน้ายกระดับองค์กรโปร่งใส-จัดโครงการพัฒนาและเพิ่มประสิทธิภาพการประเมิน-ITA-ประจำปี-2569",
      },
    ]);
    expect(linksFor("O1")).toEqual([
      {
        title: "– โครงสร้าง",
        href: "/เกี่ยวกับ-สทร/โครงสร้างองค์กร",
      },
      {
        title: "– หน้าที่และอำนาจ",
        href: "/วัตถุประสงค์การจัดตั้ง",
      },
      {
        title:
          "– พระราชกฤษฎีการจัดตั้งสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) พ.ศ.2564",
        href: "/wp-content/uploads/2023/04/พระราชกฤษฎีการจัดตั้งสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง-องค์การมหาชน-พ.ศ.2564.pdf",
      },
    ]);
    expect(linksFor("O3")).toEqual([
      {
        title: "– ช่องทางการติดต่อ",
        href: "/ติดต่อเรา/ช่องทางการติดต่อ",
      },
    ]);
    expect(linksFor("O8")).toEqual([
      {
        title: "– คู่มือการปฏิบัติงาน การรับ-ส่งหนังสือที่เป็นข้อมูลข่าวสารลับ",
        href: "/wp-content/uploads/ita2569/O8/1.wi_ข้อมูลข่าวสารลับสำนักอำนวยการ_ปรียามิต.docx",
      },
      {
        title: "– คู่มือ การจัดการเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ",
        href: "/wp-content/uploads/ita2569/O8/คู่มือ_จนท._เรื่องการจัดการเรื่องร้องเรีย.pdf",
      },
      {
        title: "– คู่มือ การจัดการเรื่องร้องเรียนแจ้งเบาะแส",
        href: "/wp-content/uploads/ita2569/O8/คู่มือ_จนท._เรื่องปฏิบัติการจัดการเรื่องร.pdf",
      },
      {
        title: "– คู่มือการปฏิบัติงานศูนย์ข้อมูลข่าวสาร สทร. (ฉบับปรับปรุง พ.ศ. 2569)",
        href: "/wp-content/uploads/ita2569/O8/คู่มือการปฏิบัติงานศูนย์ข้อมูลข่าวสาร_สทร._ฉบับปรับปรุง_พ.ศ._2569_.pdf",
      },
    ]);
    expect(linksFor("O9")).toEqual([
      {
        title: "– คู่มือการให้บริการการยืมครุภัณฑ์บุคคลภายนอก",
        href: "/wp-content/uploads/ita2569/O9/09คู่มือ_การยืมทรัพย์สินทางราชการ_บุคคลภาย.pdf",
      },
      {
        title: "– คู่มือการให้บริการข้อมูลข่าวสารของ สทร. (ฉบับปรับปรุง)",
        href: "/wp-content/uploads/ita2569/O9/09คู่มือการให้บริการข้อมูลข่าวสารของ_สทร._.pdf",
      },
      {
        title: "– คู่มือการขอเข้าศึกษาดูงานสถาบันฯ",
        href: "/sdc_download/ita2569-o9-03?inline=1",
      },
    ]);
    expect(section2024).not.toContain("Mobile-Lab-v7-Final");
    expect(linksFor("O11")).toEqual([
      {
        title: "– O11 ไตรมาสที่ 1",
        href: "/wp-content/uploads/ita2569/O11/O11_ไตรมาสที่_1.pdf",
      },
      {
        title: "– O11 ไตรมาสที่ 1 (Excel)",
        href: "/wp-content/uploads/ita2569/O11/O11_ไตรมาสที่_1.xlsx",
      },
      {
        title: "– O11 ไตรมาสที่ 2",
        href: "/wp-content/uploads/ita2569/O11/O11_ไตรมาสที่_2.pdf",
      },
      {
        title: "– O11 ไตรมาสที่ 2 (Excel)",
        href: "/wp-content/uploads/ita2569/O11/O11_ไตรมาสที่_2.xlsx",
      },
    ]);
    expect(linksFor("O13")).toEqual([
      {
        title: "– ข้อบังคับว่าด้วยการบริหารงานบุคคล",
        href: "/wp-content/uploads/ita2569/O13/o13_ข้อบังคับว่าด้วยการบริหารงานบุคคล.pdf",
      },
      {
        title: "– หลักเกณฑ์สรรหา บรรจุ แต่งตั้ง",
        href: "/wp-content/uploads/ita2569/O13/o13_หลักเกณฑ์สรรหา_บรรจุ_แต่งตั้ง.pdf",
      },
      {
        title: "– แผนบริหารทรัพยากรบุคคล ปี 2569",
        href: "/wp-content/uploads/ita2569/O13/o13_แผนบริหารทรัพยากรบุคคล_ปี_2569.pdf",
      },
      {
        title: "– แผนพัฒนาทรัพยากรบุคคล ปี 2569",
        href: "/wp-content/uploads/ita2569/O13/o13_แผนพัฒนาทรัพยากรบุคคล_ปี_2569.pdf",
      },
    ]);
    expect(linksFor("O14")).toEqual([
      {
        title: "– รายงานผลการบริหารทรัพยากรบุคคล ประจำปีงบประมาณ 2568",
        href: "/wp-content/uploads/ita2569/O14/o14_รายงานผลการบริหารทรัพยากรบุคคล_ประจำปีงบประมาณ2568(2).pdf",
      },
      {
        title: "– รายงานผลการพัฒนาทรัพยากรบุคคล ประจำปีงบประมาณ 2568",
        href: "/wp-content/uploads/ita2569/O14/o14_รายงานผลการพัฒนาทรัพยากรบุคคล_ประจำปีงบประมาณ2568(2).pdf",
      },
    ]);
    expect(linksFor("O15")).toEqual([
      {
        title: "– o15 การลงนามปฏิญญาคุณธรรม",
        href: "/wp-content/uploads/ita2569/O15/o15_การลงนามปฏิญญาคุณธรรม.pdf",
      },
      {
        title: "– o15 กิจกรรมอบรมสอดแทรกสาระด้านจริยธรรมฯ",
        href: "/wp-content/uploads/ita2569/O15/o15_กิจกรรมอบรมสอดแทรกสาระด้านจริยธรรมฯ.pdf",
      },
      {
        title: "– o15 ข้อบังคับ คกก สทร ว่าด้วยประมวลจริยธรรมในการปฏิบัติงาน 2565",
        href: "/wp-content/uploads/ita2569/O15/o15_ข้อบังคับ_คกก_สทร_ว่าด้วยประมวลจริยธรรมในการปฏิบัติงาน_2565.pdf",
      },
      {
        title: "– o15 คำสั่งแต่งตั้งคณะทำงานขับเคลื่อนจริยธรรม 2569",
        href: "/wp-content/uploads/ita2569/O15/o15_คำสั่งแต่งตั้งคณะทำงานขับเคลื่อนจริยธรรม_2569.pdf",
      },
      {
        title: "– o15 สรุปสาระสำคัญ มาตรา 128 Infographic",
        href: "/wp-content/uploads/ita2569/O15/o15_สรุปสาระสำคัญ_มาตรา_128_Infographic.png",
      },
      {
        title: "– o15 สื่อ DO and Dont RTRDA",
        href: "/wp-content/uploads/ita2569/O15/o15_สื่อ_DO_and_Dont_RTRDA.pdf",
      },
      {
        title: "– o15 ข้อกำหนดว่าด้วยกระบวนการรักษาจริยธรรม",
        href: "/wp-content/uploads/ita2569/O15/o15_ข้อกำหนดว่าด้วยกระบวนการรักษาจริยธรรม.pdf",
      },
      {
        title: "– o15 ประมวลจริยธรรม",
        href: "/wp-content/uploads/ita2569/O15/o15_ประมวลจริยธรรม.pdf",
      },
    ]);
    expect(linksFor("O16")).toEqual([
      {
        title: "– o 16 แนวทางปฏิบัติ การจัดการเรื่องร้องเรียน",
        href: "/wp-content/uploads/ita2569/O16/o_16_แนวทางปฏิบัติ_การจัดการเรื่องร้องเรียน.pdf",
      },
    ]);
    expect(linksFor("O17")).toEqual([
      {
        title: "– ช่องทางแจ้งเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ",
        href: "https://test.rtrda.or.th/%E0%B8%8A%E0%B9%88%E0%B8%AD%E0%B8%87%E0%B8%97%E0%B8%B2%E0%B8%87%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B9%81%E0%B8%88%E0%B9%89%E0%B8%87%E0%B9%80%E0%B8%A3%E0%B8%B7%E0%B9%88%E0%B8%AD%E0%B8%87%E0%B8%81%E0%B8%B2",
      },
      {
        title: "– ช่องทางแจ้งร้องเรียนฯ สำนักงาน ป.ป.ช.",
        href: "https://wbs.nacc.go.th/",
      },
      {
        title: "– ช่องทางแจ้งร้องเรียนฯ สำนักงาน ป.ป.ท.",
        href: "https://www.pacc.go.th/e-service/index.html",
      },
    ]);
    expect(linksFor("O20")).toEqual([
      {
        title:
          "– สทร.ร่วมประกาศเจตนารมณ์การต่อต้านการทุจริตคอร์รัปชันในองค์กร การไม่รับของขวัญ (No Gift Policy)",
        href: "https://test.rtrda.or.th/%E0%B8%AA%E0%B8%97%E0%B8%A3-%E0%B8%A3%E0%B9%88%E0%B8%A7%E0%B8%A1%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%81%E0%B8%B2%E0%B8%A8%E0%B9%80%E0%B8%88%E0%B8%95%E0%B8%99%E0%B8%B2%E0%B8%A3%E0%B8%A1%E0%B8%93%E0%B9%8C-no-gift-policy-2569",
      },
      {
        title: "– หนังสือประกาศเจตนารมณ์ No Gift Policy ฉบับภาษาไทย",
        href: "/sdc_download/ita2569-o20-01?inline=1",
      },
      {
        title: "– รายงานผลการดำเนินงานตามนโยบาย No Gift Policy 2568",
        href: "/sdc_download/ita2569-o20-02?inline=1",
      },
      {
        title: "– หลักเกณฑ์การรับทรัพย์สิน มาตรา 128",
        href: "/sdc_download/ita2569-o20-03?inline=1",
      },
    ]);
    expect(linksFor("O18")).toEqual([
      {
        title: "– รายงานข้อมูลสถิติเรื่องร้องเรียนการทุจร",
        href: "/wp-content/uploads/ita2569/O18/รายงานข้อมูลสถิติเรื่องร้องเรียนการทุจร.pdf",
      },
      {
        title: "– รายงานข้อมูลสถิติเรื่องร้องเรียนการทุจร (Excel)",
        href: "/wp-content/uploads/ita2569/O18/รายงานข้อมูลสถิติเรื่องร้องเรียนการทุจร.xlsx",
      },
    ]);
    expect(linksFor("O22")).toEqual([
      {
        title:
          "– ด้านที่ 2 .รายงานผลด้านการใช้ตำแหน่งหน้าที่ราชการเพื่อช่วยเหลืออำนวยความสะดวก",
        href: "/sdc_download/ita2569-o22-01",
      },
      {
        title: "– ด้านที่ 4.รายงานผล งานบุคคล ปี 2568",
        href: "/sdc_download/ita2569-o22-02",
      },
    ]);
    expect(linksFor("O25")).toEqual([
      {
        title: "– นำผลการประเมิน ITA ไปสู่การพัฒนาองค์กร",
        href: "/wp-content/uploads/ita2569/O25/นำผลการประเมิน ITA ไปสู่การพัมนาองค์กร..pdf",
      },
    ]);
    expect(linksFor("O26")).toEqual([
      {
        title: "– รายงานผลการดำเนินการเพื่อส่งเสริมคุณธรรม",
        href: "/wp-content/uploads/ita2569/O26/รายงานผลการดำเนินการเพื่อส่งเสริมคุณธรรม.pdf",
      },
    ]);
    const o10StatsLink = section2024Node
      .find("a")
      .toArray()
      .find((element) =>
        $after(element).text().includes("ข้อมูลสถิติการขอรับบริการผ่านช่องทางออนไลน์"),
      );
    expect(o10StatsLink).toBeDefined();
    if (o10StatsLink) {
      expect($after(o10StatsLink).attr("href")).toBe(
        "/wp-content/uploads/ita2569/O10/ข้อมูลสถิติการขอรับบริการผ่านช่องทางออนไลน์(E-service).pdf",
      );
    }
    const o12Heading = section2024Node
      .find("p")
      .toArray()
      .find((element) => $after(element).text().trim().startsWith("O12 "));
    expect(o12Heading).toBeDefined();
    if (o12Heading) {
      const o12Links: Array<{ title: string; href: string | undefined }> = [];
      let next = $after(o12Heading).next();
      while (next.length) {
        if (next.is("p") && /^O\d+\b/.test(next.text().trim())) {
          break;
        }
        const link = next.find("a").first();
        if (link.length) {
          o12Links.push({ title: link.text().trim(), href: link.attr("href") });
        }
        next = next.next();
      }

      expect(o12Links.map((link) => link.title)).toEqual([
        "– แบบสรุปผลการจัดซื้อจัดจ้าง ประจำปีงบประมาณ พ.ศ.2568",
        "– 12.สขร.เดือน กันยายน 2568",
        "– 12.สขร. เดือน กันยายน2568",
        "– 11.สขร เดือน สิงหาคม 2568",
        "– 11.สขร เดือน สิงหาคม 2568",
        "– 10.สขร เดือน กรกฎาคม 2568",
        "– 10.สขร เดือน กรกฎาคม 2568",
        "– 9.สขร เดือน มิถุนายน 2568",
        "– 9.สขร เดือน มิถุนายน 2568",
        "– 8.สขร เดือน พฤษภาคม 2568",
        "– 8.สขร เดือน พฤษภาคม 2568",
        "– 7.สขร เดือน เมษายน 2568",
        "– 7. สขร.เดือน เมษายน 2568",
        "– 6.สขร เดือน มีนาคม 2568",
        "– 6.สขร เดือน มีนาคม 2568",
        "– 5.สขร.เดือน กุมภาพันธ์ 2568",
        "– 5. สขร.เดือน กุมภาพันธ์ 2568",
        "– 4.สขร.เดือน มกราคม 2568",
        "– 4.สขร.เดือน มกราคม 2568",
        "– 3.สขร. เดือน ธันวาคม2567",
        "– 3.สขร.เดือน ธันวาคม 2567",
        "– 2..สขร.เดือน พฤศจิกายน 2567",
        "– 2.สขร.เดือน พฤศจิกายน 2567",
        "– 1.สขร.เดือน ตุลาคม 2567",
        "– 1.สขร.เดือน ตุลาคม 2567",
      ]);
      expect(o12Links[0]?.href).toBe(
        "/wp-content/uploads/ita2569/O12/แบบสรุปผลการจัดซื้อจัดจ้าง_ประจำปีงบประมาณ_พ.ศ.2568.pdf",
      );
      expect(o12Links.at(-1)?.href).toBe(
        "/wp-content/uploads/ita2569/O12/1.สขร.เดือน_ตุลาคม_2567.xlsx",
      );
    }
    expect(section2024Html).toContain("https://test.rtrda.or.th/");
    expect(section2024Html).toContain(
      "/wp-content/uploads/ita2569/O15/o15_ประมวลจริยธรรม.pdf",
    );
    expect(section2024Html).not.toContain("/sdc_download/ita2569-o15-");
    expect(section2024Html).toContain(
      "/wp-content/uploads/ita2569/O18/รายงานข้อมูลสถิติเรื่องร้องเรียนการทุจร.xlsx",
    );
    expect(section2024Html).toContain("/sdc_download/ita2569-o21-01");
    expect(section2024Html).toContain("/sdc_download/ita2569-o22-01");
    expect(section2024Html).toContain("/sdc_download/ita2569-o22-02");
    expect(section2024Html).not.toContain("https://www.rtrda.or.th/en/");
  });
});
