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

const ITA_O19_NEWS_TITLE =
  "สทร. จัดประชุมเทคนิคพิจารณ์ ร่าง มาตรฐานหมอนคอนกรีตและอุปกรณ์ยึดเหนี่ยวราง ครั้งที่ 1/2568 มุ่งยกระดับคุณภาพและความปลอดภัยของระบบรางไทยสู่ระดับสากล";

const ITA_O10_E_SERVICE_STATS_HREF =
  "/wp-content/uploads/ita2569/O10/ข้อมูลสถิติการขอรับบริการผ่านช่องทางออนไลน์(E-service).pdf";

const ITA_LINK_OVERRIDES: ReadonlyArray<{
  marker: string;
  links: ReadonlyArray<{ title: string; href: string }>;
}> = [
  {
    marker: "O10",
    links: [
      {
        title: "ข้อมูลสถิติการขอรับบริการผ่านช่องทางออนไลน์(E-service)",
        href: ITA_O10_E_SERVICE_STATS_HREF,
      },
      {
        title: "คู่มือการให้บริการ-E-Service",
        href: "/wp-content/uploads/ita2569/O10/o10-คู่มือการให้บริการ-E-Service.pdf",
      },
      {
        title: "E-Service",
        href: "/e-services",
      },
    ],
  },
  {
    marker: "O15",
    links: [
      {
        title: "o15 406.34 แต่งตั้งคณะทำงานขับเคลื่อนจริยธรรม(2.1)",
        href: sdcDownloadHref("ita2569-o15-01"),
      },
      {
        title: "o15 การลงนามปฏิญญาคุณธรรม(2.2)",
        href: sdcDownloadHref("ita2569-o15-02"),
      },
      {
        title: "o15 กิจกรรมอบรมสอดแทรกสาระด้านจริยธรรมฯ(2.3)",
        href: sdcDownloadHref("ita2569-o15-03"),
      },
      {
        title: "o15 ข้อบังคับ คกก สทร ว่าด้วยประมวลจริยธรรมใ",
        href: sdcDownloadHref("ita2569-o15-04"),
      },
      {
        title: "o15 สื่อ DO and Dont RTRDA(2,2.1)",
        href: sdcDownloadHref("ita2569-o15-05"),
      },
      {
        title: "o15_ข้อกำหนดว่าด้วยกระบวนการรักษาจริยธรรม(1.2",
        href: sdcDownloadHref("ita2569-o15-06"),
      },
      {
        title: "o15_ประมวลจริยธรรม(1.1)",
        href: sdcDownloadHref("ita2569-o15-07"),
      },
    ],
  },
  {
    marker: "O18",
    links: [
      {
        title: "รายงานข้อมูลสถิติเรื่องร้องเรียนการทุจร",
        href: sdcDownloadHref("ita2569-o18-01"),
      },
      {
        title: "รายงานข้อมูลสถิติเรื่องร้องเรียนการทุจร (Excel)",
        href: sdcDownloadHref("ita2569-o18-02"),
      },
    ],
  },
  {
    marker: "O19",
    links: [
      {
        title: ITA_O19_NEWS_TITLE,
        href: "https://test.rtrda.or.th/สทร-จัดประชุมเทคนิคพิจ-3/",
      },
      {
        title: "แบบฟอร์มการมีส่วนร่วมo19_v3",
        href: sdcDownloadHref("ita2569-o19-01"),
      },
      {
        title: "เอกสารประกอบที่ 1 คำสั่งสทรที่52-2568",
        href: sdcDownloadHref("ita2569-o19-02"),
      },
      {
        title: "เอกสารประกอบที่ 2 รายงานประชุม ครั้งที่ 4-2568",
        href: sdcDownloadHref("ita2569-o19-03"),
      },
      {
        title: "เอกสารประกอบที่ 3 สรุปการประชุมTechnical Hearing",
        href: sdcDownloadHref("ita2569-o19-04"),
      },
      {
        title: "เอกสารประกอบที่ 4 รายงานประชุม ครั้งที่ 10-2568",
        href: sdcDownloadHref("ita2569-o19-05"),
      },
      {
        title: "เอกสารประกอบที่ 5 รายงานการประชุม ครั้งที่ 26(4)-2568",
        href: sdcDownloadHref("ita2569-o19-06"),
      },
      {
        title: "เอกสารประกอบที่ 6 รายงานการจัดทำประชาพิจารณ์",
        href: sdcDownloadHref("ita2569-o19-07"),
      },
    ],
  },
  {
    marker: "O21",
    links: [
      {
        title: "การประเมินความเสี่ยงทุจริต_5_ขั้นตอน_ตามคู",
        href: sdcDownloadHref("ita2569-o21-01"),
      },
    ],
  },
  {
    marker: "O22",
    links: [
      {
        title: "รายงานผลการดำเนินงานตามแผนบริหารจัดการค",
        href: sdcDownloadHref("ita2569-o22-01"),
      },
    ],
  },
];

const ITA_2024_ANCHOR = "การประเมิน ITA ปี 2569";

function sdcDownloadHref(id: string): string {
  return `/sdc_download/${id}`;
}

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

function isItaHeadingParagraph($: cheerio.CheerioAPI, element: AnyNode): boolean {
  return /^O\d+\b/.test($(element).text().trim());
}

function linkParagraph($: cheerio.CheerioAPI, title: string, href: string): string {
  const paragraph = $("<p></p>");
  const link = $("<a></a>");
  link.attr("href", href);
  link.text(`– ${title}`);
  paragraph.append(link);
  return $.html(paragraph);
}

function applyLinkOverridesToSubtree(
  $: cheerio.CheerioAPI,
  subtree: cheerio.Cheerio<AnyNode>,
): { didChange: boolean } {
  let didChange = false;

  for (const override of ITA_LINK_OVERRIDES) {
    const heading = subtree
      .find("p")
      .toArray()
      .find((element) => $(element).text().trim().startsWith(`${override.marker} `));

    if (!heading) {
      console.warn(
        `[ita-headings-override] expected link section not found in 2569 section: ${override.marker}`,
      );
      continue;
    }

    const $heading = $(heading);
    const headingText = $heading.text().trim();

    const existingLinks: Array<{ title: string; href: string | undefined }> = [];
    let scan = $heading.next();
    while (scan.length) {
      if (scan[0] && scan.is("p") && isItaHeadingParagraph($, scan[0])) {
        break;
      }
      if (scan.is("h1, h2, h3, h4, h5, h6")) {
        break;
      }
      if (scan.is("p")) {
        const link = scan.find("a").first();
        existingLinks.push({ title: link.text().trim(), href: link.attr("href") });
      }
      scan = scan.next();
    }

    const expectedLinks = override.links.map((link) => ({
      title: `– ${link.title}`,
      href: link.href,
    }));
    const linksAlreadyMatch =
      existingLinks.length === expectedLinks.length &&
      existingLinks.every(
        (link, index) =>
          link.title === expectedLinks[index]?.title &&
          link.href === expectedLinks[index]?.href,
      );
    if (linksAlreadyMatch && $heading.text().trim() === headingText) {
      continue;
    }

    $heading.empty().append($("<strong></strong>").text(headingText));

    let next = $heading.next();
    while (next.length) {
      if (next[0] && next.is("p") && isItaHeadingParagraph($, next[0])) {
        break;
      }
      if (next.is("h1, h2, h3, h4, h5, h6")) {
        break;
      }

      const current = next;
      next = next.next();
      current.remove();
    }

    $heading.after(
      override.links.map((link) => linkParagraph($, link.title, link.href)).join("\n"),
    );
    didChange = true;
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

  const replacementResult = applyReplacementsToSubtree(
    $,
    subtree,
    expectedHeadingMarkers,
  );
  const linkResult = applyLinkOverridesToSubtree($, subtree);
  if (!replacementResult.didChange && !linkResult.didChange) {
    return record;
  }

  return { ...record, contentHtml: $.html() };
}
