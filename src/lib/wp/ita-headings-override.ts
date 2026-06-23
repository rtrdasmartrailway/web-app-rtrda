import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { WpContentRecord } from "./types";

const THAI_ITA_PAGE_ID = "th-page-4837";

export const ITA_HEADING_REPLACEMENTS: ReadonlyArray<[string, string]> = [
  [
    "O3 ข้อมูลการติดต่อ",
    "O3 แบบวัดการเปิดเผยข้อมูลสาธารณะ (MOPH Open Data Integrity & Transparency Assessment: MOIT) ประจำปีงบประมาณ พ.ศ. 2569",
  ],
  ["O10 E–Service", "O10 ระบบการให้บริการผ่านช่องทางออนไลน์ (E-SERVICE)"],
  [
    "O11 ข้อมูลสถิติการให้บริการ",
    "O11 สรุปผลการจัดซื้อจัดจ้างหรือการจัดหาพัสดุรายเดือน ประจำปีงบประมาณ พ.ศ. 2569",
  ],
  [
    "O12 รายการการจัดซื้อจัดจ้างหรือการจัดหาพัสดุ และความก้าวหน้าการจัดซื้อจัดจ้างหรือการจัดหาพัสดุ",
    "O12 รายงานสรุปผลการจัดซื้อจัดจ้างหรือการจัดหาพัสดุของหน่วยงาน ประจำปีงบประมาณ พ.ศ. 2568",
  ],
  [
    "O13 รายงานผลการจัดซื้อจัดจ้างหรือการจัดหาพัสดุประจำปี พ.ศ. 2568",
    "O13 หลักเกณฑ์และแผนการบริหารและพัฒนาทรัพยากรบุคคล ประจำปีงบประมาณ พ.ศ. 2569",
  ],
  [
    "O14 แผนการบริหารและพัฒนาทรัพยากรบุคคลประจำปีงบประมาณ พ.ศ. 2569",
    "O14 รายงานผลการบริหารและพัฒนาทรัพยากรบุคคล ประจำปีงบประมาณ พ.ศ.. 2568",
  ],
  [
    "O15 รายงานผลการบริหารและพัฒนาทรัพยากรบุคคลประจำปี พ.ศ. 2568",
    "O15 ประมวลจริยธรรมการขับเคลื่อนจริยธรรม",
  ],
  [
    "O16 ประมวลจริยธรรมและการขับเคลื่อนจริยธรรม",
    "O16 แนวปฏิบัติการจัดการเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ",
  ],
  [
    "O17 แนวปฏิบัติการจัดการเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ",
    "O17 ช่องทางแจ้งเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ",
  ],
  [
    "O18 ช่องทางแจ้งเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ",
    "O18 ข้อมูลสถิติเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ ประจำปีงบประมาณ พ.ศ..2568",
  ],
  [
    "O19 ข้อมูลสถิติเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ ประจำปี พ.ศ. 2568",
    "O19 ผลการเปิดโอกาสให้มีส่วนร่วมในการดำเนินงาน ปีงบประมาณ พ.ศ. 2569",
  ],
  [
    "O20 การเปิดโอกาสให้เกิดการมีส่วนร่วม",
    "O20 การขับเคลื่อนนโยบาย NO GIFT POLICY จากการปฏิบัติหน้าที่และการเสริมสร้างความรู้เกี่ยวกับหลักเกณฑ์การรับทรัพย์สินหรือประโยชน์อื่นใดโดยธรรมจรรยาของเจ้าพนักงานของรัฐ",
  ],
  [
    "O21 ประกาศเจตนารมณ์และการสร้างวัฒนธรรม ตามนโยบาย No Gift Policy จากการปฏิบัติหน้าที่",
    "O21 การประเมินความเสี่ยงการทุจริตในหน่วยงานภาครัฐ ประจำปีงบประมาณ พ.ศ. 2569",
  ],
  [
    "O22 รายงานการรับทรัพย์สินหรือประโยชน์อื่นใดโดยธรรมจรรยา",
    "O22 รายงานผลการดำเนินการตามแผนบริหารจัดการความเสี่ยงการทุจริตของหน่วยงาน ประจำปีงบประมาณ พ.ศ. 2568",
  ],
  [
    "O23 การประเมินความเสี่ยงที่อาจเกิดการให้หรือรับสินบนจากการดำเนินงานตามภารกิจของหน่วยงานประจำปี พ.ศ. 2569",
    "O23 แผนปฏิบัติการป้องกันการทุจริต ปีงบประมาณ พ.ศ. 2569",
  ],
  [
    "O24 รายงานผลการดำเนินการเพื่อจัดการความเสี่ยงการทุจริตและประพฤติมิชอบประจำปี พ.ศ. 2568",
    "O24 รายงานผลการดำเนินการป้องกันการทุจริต ปีงบประมาณ พ.ศ.. 2568",
  ],
  [
    "O25 แผนปฏิบัติการป้องกันปราบปรามการทุจริตและประพฤติมิชอบ และส่งเสริมคุณธรรมจริยธรรมของกระทรวงคมนาคม ประจำปีงบประมาณ พ.ศ. 2569",
    "O25 การนำผลการประเมิน ITA ไปสู่การพัฒนาองค์กร",
  ],
  [
    "O26 รายงานผลการดำเนินงานตามแผนปฏิบัติการป้องกันปราบปรามการทุจริตและประพฤติมิชอบ และส่งเสริมคุณธรรมจริยธรรมของกระทรวงคมนาคม ประจำปีงบประมาณ พ.ศ. 2568",
    "O26 รายงานผลการดำเนินการเพื่อส่งเสริมคุณธรรมและความโปร่งใสภายในหน่วยงานปีงบประมาณ พ.ศ.. 2568",
  ],
];

const ITA_2024_ANCHOR = "การประเมิน ITA ปี 2569";

function shouldOverride(record: WpContentRecord): boolean {
  return record.id === THAI_ITA_PAGE_ID;
}

function findIt2024Section($: cheerio.CheerioAPI): cheerio.Cheerio<AnyNode> | null {
  const sections = $("div.lightweight-accordion-body").toArray();
  for (const element of sections) {
    const $node = $(element);
    if ($node.text().includes(ITA_2024_ANCHOR)) {
      return $node;
    }
  }
  return null;
}

function applyReplacementsToSubtree(
  $: cheerio.CheerioAPI,
  subtree: cheerio.Cheerio<AnyNode>,
  expectedHeadingMarkers: Set<string>,
): { didChange: boolean } {
  let didChange = false;
  for (const [needle, replacement] of ITA_HEADING_REPLACEMENTS) {
    const sectionText = subtree.text();
    if (sectionText.includes(replacement)) {
      continue;
    }
    if (!sectionText.includes(needle)) {
      const firstWord = needle.split(" ")[0];
      if (firstWord && expectedHeadingMarkers.has(firstWord)) {
        console.warn(
          `[ita-headings-override] expected heading not found in 2569 section: "${needle.slice(0, 80)}…"`,
        );
      }
      continue;
    }
    let nodeChanged = false;
    subtree.find("p, h1, h2, h3, h4, h5, h6, strong, a, li, span").each((_, element) => {
      const $el = $(element);
      const html = $el.html();
      if (!html || !html.includes(needle)) {
        return;
      }
      const replaced = html.split(needle).join(replacement);
      if (replaced !== html) {
        $el.html(replaced);
        nodeChanged = true;
      }
    });
    if (nodeChanged) {
      didChange = true;
    }
  }
  return { didChange };
}

export function applyItaHeadingsOverride(record: WpContentRecord): WpContentRecord {
  if (!shouldOverride(record)) {
    return record;
  }

  const $ = cheerio.load(record.contentHtml, null, false);
  const subtree = findIt2024Section($);
  if (!subtree) {
    console.warn(
      `[ita-headings-override] could not locate 2024 (ITA ปี 2569) section in ${record.id}; skipping all replacements.`,
    );
    return record;
  }

  const expectedHeadingMarkers = new Set(
    ITA_HEADING_REPLACEMENTS.map(([needle]) => needle.split(" ")[0]).filter(
      (marker): marker is string => Boolean(marker),
    ),
  );

  const { didChange } = applyReplacementsToSubtree($, subtree, expectedHeadingMarkers);
  if (!didChange) {
    return record;
  }

  return { ...record, contentHtml: $.html() };
}
