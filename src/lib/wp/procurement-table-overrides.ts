import * as cheerio from "cheerio";
import type { Cheerio } from "cheerio";
import type { AnyNode } from "domhandler";
import type { WpContentRecord } from "./types";
import { normalizeRoutePath } from "./url";

interface TableRowSpec {
  matchText: string;
  cells: string[];
  href: string;
}

const YEAR_2569 = "ปี 2569";
const PUBLISHED_STATUS = "เผยแพร่ขึ้นเว็บ";

const QUARTERLY_WINNER_PATH = "/จัดซื้อจัดจ้าง/ประกาศผลผู้ชนะการจัดซื";
const PROCUREMENT_SUMMARY_PATH = "/จัดซื้อจัดจ้าง/ประกาศจดซอจดจางตามแบบส";
const PROCUREMENT_WINNER_PATH = "/จัดซื้อจัดจ้าง/ประกาศผลผู้ชนะการเสนอร";
const PROCUREMENT_CANCEL_WINNER_PATH = "/จัดซื้อจัดจ้าง/ยกเลิกประกาศเชิญชวน-ผู้";
const RAIL_STANDARDS_PATH = "/มาตรฐานระบบราง-สทร";

const uploadFile = (path: string) => `/wp-content/uploads/${path}`;

const quarterlyRows: TableRowSpec[] = [
  {
    matchText: "ประกาศผลผู้ชนะการจัดซื้อจัดจ้างหรือผู้ได้รับการคัดเลือก ประจำไตรมาสที่ 3",
    cells: [
      "7 กรกฎาคม 2569",
      "ประกาศผลผู้ชนะการจัดซื้อจัดจ้างหรือผู้ได้รับการคัดเลือก ประจำไตรมาสที่ 3 (เดือนเมษายน 2569 ถึง เดือน มิถุนายน 2569)",
      PUBLISHED_STATUS,
    ],
    href: uploadFile("2026/07/procurement-quarterly-winner-q3-2569.pdf"),
  },
];

const summaryRows: TableRowSpec[] = [
  {
    matchText: "3 กรกฎาคม 2569 สรุปผลการดำเนินการจัดซื้อจัดจ้างในรอบเดือน มิถุนายน",
    cells: [
      "3 กรกฎาคม 2569",
      "สรุปผลการดำเนินการจัดซื้อจัดจ้างในรอบเดือน มิถุนายน",
      PUBLISHED_STATUS,
    ],
    href: uploadFile("2026/07/procurement-summary-june-2569-20260703.pdf"),
  },
  {
    matchText: "11 มิถุนายน 2569 สรุปผลการดำเนินการจัดซื้อจัดจ้างในรอบเดือน มิถุนายน",
    cells: [
      "11 มิถุนายน 2569",
      "สรุปผลการดำเนินการจัดซื้อจัดจ้างในรอบเดือน มิถุนายน",
      PUBLISHED_STATUS,
    ],
    href: uploadFile("2026/07/procurement-summary-june-2569-20260611.pdf"),
  },
];

const winnerRows: TableRowSpec[] = [
  {
    matchText: "เช่าพื้นที่ สำหรับงานวิศวกรรมแห่งชาติ 2569",
    cells: [
      "17 กรกฎาคม 2569",
      "ประกาศผู้ชนะการเสนอราคา เช่าพื้นที่ สำหรับงานวิศวกรรมแห่งชาติ 2569 (International Engineering Expo 2026)",
      "160,500.00",
      "–",
    ],
    href: uploadFile("2026/07/ประกาศผู้ชนะ_17_07_2569.pdf?v=20260717"),
  },
  {
    matchText:
      "จ้างที่ปรึกษาศึกษารูปแบบและแนวทางการลงทุนภายใต้ขอบเขตหน้าที่และอำนาจทางกฎหมาย",
    cells: [
      "8 กรกฎาคม 2569",
      "เรื่อง ประกาศผู้ชนะการเสนอราคา จ้างที่ปรึกษาศึกษารูปแบบและแนวทางการลงทุนภายใต้ขอบเขตหน้าที่และอำนาจทางกฎหมาย รวมทั้งการบริหารจัดการทรัพย์สินทางปัญญาของสถาบัน โดยวิธีจ้างที่ปรึกษาโดยวิธีคัดเลือก",
      "4,300,000.00",
      "–",
    ],
    href: uploadFile("2026/07/procurement-winner-consultant-ip-management-25690708.pdf"),
  },
  {
    matchText: "จ้างออกแบบและจัดทำของที่ระลึกเพื่อใช้ในกิจกรรมของสถาบัน",
    cells: [
      "8 กรกฎาคม 2569",
      "เรื่อง ประกาศผู้ชนะการเสนอราคา จ้างออกแบบและจัดทำของที่ระลึกเพื่อใช้ในกิจกรรมของสถาบันวิจัยและพัฒนาเทคโนโลยี ระบบราง (องค์การมหาชน) โดยวิธีเฉพาะเจาะจง",
      "249,738.00",
      "–",
    ],
    href: uploadFile("2026/07/procurement-winner-souvenir-design-25690708.pdf"),
  },
  {
    matchText:
      "โครงการศึกษาการผลิตรถไฟภายในประเทศ และแนวทางการจัดตั้งบริษัทเพื่อผลิตรถไฟแห่งชาติ",
    cells: [
      "8 กรกฎาคม 2569",
      "เรื่อง ประกาศผู้ชนะการเสนอราคา ขออนุมัติดำเนินการงานจ้างที่ปรึกษาโครงการศึกษาการผลิตรถไฟภายในประเทศ และแนวทางการจัดตั้งบริษัทเพื่อผลิตรถไฟแห่งชาติ (National Rolling Stock Company) โดยวิธีจ้างที่ปรึกษาโดยวิธีคัดเลือก",
      "7,950,000.00",
      "–",
    ],
    href: uploadFile(
      "2026/07/procurement-winner-national-rolling-stock-company-25690708.pdf",
    ),
  },
  {
    matchText: "จัดจ้างงานออกแบบและพิมพ์รายงานประจำปี 2568",
    cells: [
      "7 กรกฎาคม 2569",
      "เรื่อง ประกาศผู้ชนะการเสนอราคา จัดจ้างงานออกแบบและพิมพ์รายงานประจำปี 2568 ของสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) โดยวิธีเฉพาะเจาะจง",
      "342,400.00",
      "–",
    ],
    href: uploadFile("2026/07/procurement-winner-annual-report-design-print-2568.pdf"),
  },
  {
    matchText:
      "โครงการยกระดับโครงสร้างพื้นฐานทางรางของประเทศ (Infrastructure Enhancement)",
    cells: [
      "7 กรกฎาคม 2569",
      "เรื่อง ประกาศผู้ชนะการเสนอราคา ขออนุมัติดำเนินการจัดจ้างที่ปรึกษา โครงการยกระดับโครงสร้างพื้นฐานทางรางของประเทศ (Infrastructure Enhancement) โดยวิธีจ้างทีปรึกษาโดยวิธีคัดเลือก",
      "11,354,305.00",
      "–",
    ],
    href: uploadFile(
      "2026/07/procurement-winner-infrastructure-enhancement-consultant.pdf",
    ),
  },
];

const railComponentDocuments: Array<{
  code: string;
  title: string;
  href: string;
  image: string;
}> = [
  {
    code: "CT-(2002-2005)-2569",
    title: "ชุดมาตรฐานอุปกรณ์ยึดเหนี่ยวราง",
    href: uploadFile(
      "standards/rail-components/ct-2002-2005-2569-rail-fastening-components.pdf",
    ),
    image: uploadFile(
      "standards/rail-components/ct-2002-2005-2569-rail-fastening-components.png",
    ),
  },
  {
    code: "CT-(2006-2010)-2569",
    title: "ชุดมาตรฐานหมอนคอนกรีตและหมอนประแจคอนกรีต",
    href: uploadFile(
      "standards/rail-components/ct-2006-2010-2569-concrete-sleeper-turnout-sleeper.pdf",
    ),
    image: uploadFile(
      "standards/rail-components/ct-2006-2010-2569-concrete-sleeper-turnout-sleeper.png",
    ),
  },
  {
    code: "CT-(6005-6014)-2569",
    title: "ชุดมาตรฐานการทดสอบอุปกรณ์ยึดเหนี่ยวราง",
    href: uploadFile(
      "standards/rail-components/ct-6005-6014-2569-rail-fastening-test-standards.pdf",
    ),
    image: uploadFile(
      "standards/rail-components/ct-6005-6014-2569-rail-fastening-test-standards.png",
    ),
  },
  {
    code: "CT-1001-2569",
    title: "มาตรฐานการออกแบบหมอนคอนกรีตและหมอนประแจคอนกรีต",
    href: uploadFile(
      "standards/rail-components/ct-1001-2569-concrete-sleeper-design.pdf",
    ),
    image: uploadFile(
      "standards/rail-components/ct-1001-2569-concrete-sleeper-design.png",
    ),
  },
  {
    code: "CT-8001-2569",
    title: "มาตรฐานบทนิยามเกี่ยวกับหมอนรองรางและอุปกรณ์ยึดเหนี่ยวราง",
    href: uploadFile(
      "standards/rail-components/ct-8001-2569-rail-sleeper-fastening-definitions.pdf",
    ),
    image: uploadFile(
      "standards/rail-components/ct-8001-2569-rail-sleeper-fastening-definitions.png",
    ),
  },
];

const railWeldingDocuments = [
  {
    title: "มาตรฐานแนะนำการเชื่อมซ่อมผิวหัวรางด้วยการเชื่อมอาร์ก",
    image: uploadFile("2026/01/124.jpg"),
    previewHref: "/3d-flip-book/ct-70012568",
    downloadHref: "/sdc_download/7166",
  },
  {
    title: "มาตรฐานการทดสอบเพื่อรับรองการเชื่อมซ่อมผิวหัวรางด้วยการเชื่อมอาร์ก",
    image: uploadFile("2026/01/123.jpg"),
    previewHref: "/3d-flip-book/สทร-ct60012568",
    downloadHref: "/sdc_download/7169",
  },
  {
    title: "ชุดมาตรฐานการทดสอบโดยไม่ทำลายบนรอยเชื่อมรางรถไฟ",
    image: uploadFile("2026/01/125.jpg"),
    previewHref: "/3d-flip-book/ct-6002_6004_2568",
    downloadHref: "/sdc_download/7163",
  },
  {
    title: "สทร-RS-6001-2568",
    image: uploadFile("2026/07/rtrda-rs-6001-2568.png"),
    previewHref: "/3d-flip-book/สทร-rs-6001-2568",
    downloadHref: uploadFile("2025/12/สทร-RS-6001-2568.pdf"),
  },
  {
    title: "สทร-RS-6002-2568",
    image: uploadFile("2026/07/rtrda-rs-6002-2568.png"),
    previewHref: "/3d-flip-book/สทร-rs-6002-2568",
    downloadHref: uploadFile("2025/12/สทร-RS-6002-2568.pdf"),
  },
];

const otherRailStandardDocuments = [
  {
    title: "รายงานการพัฒนามาตรฐานระบบราง",
    image: uploadFile("2024/08/หน้าปก-บทความ-มาตรฐาน-สทร_final-edit.png"),
    previewHref: "/sdc_download/5544",
    downloadHref: "/sdc_download/5544",
  },
];

const railDevelopmentPlanDocuments = [
  {
    title: "แผนพัฒนามาตรฐานระบบขนส่งทางรางของ สทร.",
    href: uploadFile("2026/07/rtrda-rail-standards-development-plan.pdf"),
    image: uploadFile("2026/07/rtrda-rail-standards-development-plan.png"),
  },
];

const railStandardsCompilationDocuments = [
  {
    title: "ประมวลมาตรฐานระบบขนส่งทางรางด้านระบบไฟฟ้า",
    href: uploadFile("2026/07/rtrda-rail-standards-electrical-systems.pdf"),
    image: uploadFile("2026/07/rtrda-rail-standards-electrical-systems.png"),
  },
  {
    title: "ประมวลมาตรฐานระบบขนส่งทางรางด้านสิ่งแวดล้อมและพลังงาน",
    href: uploadFile("2026/07/rtrda-rail-standards-environment-energy.pdf"),
    image: uploadFile("2026/07/rtrda-rail-standards-environment-energy.png"),
  },
  {
    title: "ประมวลมาตรฐานระบบขนส่งทางรางด้านระบบการเดินรถและซ่อมบำรุง",
    href: uploadFile("2026/07/rtrda-rail-standards-operations.pdf"),
    image: uploadFile("2026/07/rtrda-rail-standards-operations.png"),
  },
  {
    title: "ประมวลมาตรฐานระบบขนส่งทางรางด้านระบบอาณัติสัญญาณและการสื่อสาร",
    href: uploadFile("2026/07/rtrda-rail-standards-signaling.pdf"),
    image: uploadFile("2026/07/rtrda-rail-standards-signaling.png"),
  },
  {
    title: "ประมวลมาตรฐานระบบขนส่งทางรางด้านความปลอดภัยและความมั่นคง",
    href: uploadFile("2026/07/rtrda-rail-standards-safety.pdf"),
    image: uploadFile("2026/07/rtrda-rail-standards-safety.png"),
  },
  {
    title: "ประมวลมาตรฐานระบบขนส่งทางรางด้านล้อเลื่อน",
    href: uploadFile("2026/07/rtrda-rail-standards-rolling-stock.pdf"),
    image: uploadFile("2026/07/rtrda-rail-standards-rolling-stock.png"),
  },
];

function normalized(path: string): string {
  return normalizeRoutePath(path).normalize("NFC");
}

function td($: cheerio.CheerioAPI, text: string): Cheerio<AnyNode> {
  return $("<td></td>")
    .addClass("has-text-align-center")
    .attr("data-align", "center")
    .text(text);
}

function buildRow($: cheerio.CheerioAPI, row: TableRowSpec): Cheerio<AnyNode> {
  const tr = $("<tr></tr>");
  tr.append(td($, ""));
  row.cells.forEach((text) => tr.append(td($, text)));
  const linkCell = td($, "");
  linkCell.append(
    $("<a></a>")
      .attr("href", row.href)
      .attr("target", "_blank")
      .attr("rel", "noreferrer noopener")
      .text("PDF"),
  );
  tr.append(linkCell);
  return tr;
}

function rowText($: cheerio.CheerioAPI, row: AnyNode): string {
  return $(row).text().replace(/\s+/g, " ").trim();
}

function renumberRows(
  $: cheerio.CheerioAPI,
  tbody: Cheerio<AnyNode>,
  numberBottomUp = false,
): boolean {
  let changed = false;
  const rows = tbody.find("tr").toArray();

  rows.forEach((row, index) => {
    const first = $(row).find("td").first();
    const nextNumber = String(numberBottomUp ? rows.length - index : index + 1);
    if (first.text().trim() !== nextNumber) {
      first.text(nextNumber);
      changed = true;
    }
  });

  return changed;
}

function findYearTable($: cheerio.CheerioAPI, year: string): Cheerio<AnyNode> {
  const accordion = $(".lightweight-accordion")
    .filter((_, element) =>
      $(element)
        .find("summary")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim()
        .includes(year),
    )
    .first();
  return accordion.find("tbody").first();
}

function ensureYearTable($: cheerio.CheerioAPI, year: string): Cheerio<AnyNode> {
  const existing = findYearTable($, year);
  if (existing.length > 0) return existing;

  const firstAccordion = $(".lightweight-accordion").first();
  if (firstAccordion.length === 0) return $([]);

  const newAccordion = firstAccordion.clone();
  newAccordion.find("summary").first().html(`<h1><strong>${year}</strong></h1>`);
  newAccordion.find("tbody").first().empty();
  firstAccordion.before(newAccordion);
  return newAccordion.find("tbody").first();
}

function upsertRows(
  $: cheerio.CheerioAPI,
  tbody: Cheerio<AnyNode>,
  rows: TableRowSpec[],
  options: { numberBottomUp?: boolean } = {},
): boolean {
  if (tbody.length === 0) return false;
  let changed = false;
  for (const spec of [...rows].reverse()) {
    const existing = tbody
      .find("tr")
      .filter((_, row) => rowText($, row).includes(spec.matchText))
      .first();
    if (existing.length) {
      spec.cells.forEach((text, index) => {
        const cell = existing.find("td").eq(index + 1);
        if (cell.length && cell.text().trim() !== text) {
          cell.text(text);
          changed = true;
        }
      });
      const link = existing.find("td").last().find("a").first();
      if (link.attr("href") !== spec.href) {
        link
          .attr("href", spec.href)
          .attr("target", "_blank")
          .attr("rel", "noreferrer noopener");
        changed = true;
      }
      continue;
    }
    tbody.prepend(buildRow($, spec));
    changed = true;
  }

  changed = renumberRows($, tbody, options.numberBottomUp) || changed;

  return changed;
}

const thaiMonthNumbers: Record<string, number> = {
  มกราคม: 1,
  กุมภาพันธ์: 2,
  มีนาคม: 3,
  เมษายน: 4,
  พฤษภาคม: 5,
  มิถุนายน: 6,
  กรกฎาคม: 7,
  สิงหาคม: 8,
  กันยายน: 9,
  ตุลาคม: 10,
  พฤศจิกายน: 11,
  ธันวาคม: 12,
};

function thaiDateValue($: cheerio.CheerioAPI, row: AnyNode): number {
  const match = $(row)
    .find("td")
    .eq(1)
    .text()
    .match(
      /(\d{1,2})\s+(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s+(\d{4})/,
    );
  if (!match) return Number.MIN_SAFE_INTEGER;

  const [, day, month, year] = match;
  return Number(year) * 10_000 + thaiMonthNumbers[month] * 100 + Number(day);
}

function sortRowsByThaiDateDescending(
  $: cheerio.CheerioAPI,
  tbody: Cheerio<AnyNode>,
): boolean {
  const originalRows = tbody.find("tr").toArray();
  const sortedRows = [...originalRows].sort(
    (left, right) => thaiDateValue($, right) - thaiDateValue($, left),
  );
  const changed = sortedRows.some((row, index) => row !== originalRows[index]);
  if (changed) {
    sortedRows.forEach((row) => tbody.append(row));
  }

  return changed;
}

function applyYearTableRows(
  record: WpContentRecord,
  rows: TableRowSpec[],
  options: { createYear?: boolean; numberBottomUp?: boolean } = {},
): WpContentRecord {
  const $ = cheerio.load(record.contentHtml, null, false);
  const tbody = options.createYear
    ? ensureYearTable($, YEAR_2569)
    : findYearTable($, YEAR_2569);
  const changed = upsertRows($, tbody, rows, options);
  return changed ? { ...record, contentHtml: $.html() } : record;
}

function applyEmptyCancelWinnerTable(record: WpContentRecord): WpContentRecord {
  const $ = cheerio.load(record.contentHtml, null, false);
  const hasYearTable = findYearTable($, YEAR_2569).length > 0;
  const tbody = ensureYearTable($, YEAR_2569);
  if (tbody.length === 0) return record;

  const hasRows = tbody.find("tr").length > 0;
  if (hasRows) {
    tbody.empty();
  }

  return !hasYearTable || hasRows ? { ...record, contentHtml: $.html() } : record;
}

function quarterNumber($: cheerio.CheerioAPI, row: AnyNode): number {
  const match = rowText($, row).match(/ไตรมาสที่\s*(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function sortQuarterlyRowsDescending(
  $: cheerio.CheerioAPI,
  tbody: Cheerio<AnyNode>,
): boolean {
  const originalRows = tbody.find("tr").toArray();
  const sortedRows = [...originalRows].sort(
    (left, right) => quarterNumber($, right) - quarterNumber($, left),
  );
  const changed = sortedRows.some((row, index) => row !== originalRows[index]);
  if (changed) {
    sortedRows.forEach((row) => tbody.append(row));
  }
  return changed;
}

function applyQuarterlyWinnerRows(record: WpContentRecord): WpContentRecord {
  const $ = cheerio.load(record.contentHtml, null, false);
  const tbody = findYearTable($, YEAR_2569);
  let changed = upsertRows($, tbody, quarterlyRows);
  changed = sortQuarterlyRowsDescending($, tbody) || changed;
  const quarterlyRowsInDisplayOrder = tbody.find("tr").toArray();
  quarterlyRowsInDisplayOrder.forEach((row, index) => {
    const first = $(row).find("td").first();
    const nextNumber = String(quarterlyRowsInDisplayOrder.length - index);
    if (first.text().trim() !== nextNumber) {
      first.text(nextNumber);
      changed = true;
    }
  });
  return changed ? { ...record, contentHtml: $.html() } : record;
}

function applyWinnerRows(record: WpContentRecord): WpContentRecord {
  const $ = cheerio.load(record.contentHtml, null, false);
  const tbody = findYearTable($, YEAR_2569);
  let changed = upsertRows($, tbody, winnerRows, { numberBottomUp: true });

  changed = sortRowsByThaiDateDescending($, tbody) || changed;
  changed = renumberRows($, tbody, true) || changed;

  return changed ? { ...record, contentHtml: $.html() } : record;
}

function buildRailComponentCard(
  $: cheerio.CheerioAPI,
  doc: { code: string; title: string; href: string; image: string },
): Cheerio<AnyNode> {
  const column = $("<article></article>").addClass(
    "rtrda-rail-component-card wp-block-column is-vertically-aligned-top is-layout-flow wp-block-column-is-layout-flow",
  );
  const image = $("<div></div>")
    .addClass("wp-block-image is-style-vk-image-shadow")
    .append(
      $("<figure></figure>")
        .addClass("aligncenter size-full is-resized")
        .append(
          $("<img>")
            .attr("loading", "lazy")
            .attr("decoding", "async")
            .attr("width", "600")
            .attr("height", "852")
            .attr("src", doc.image)
            .attr("alt", doc.title),
        ),
    );

  const heading = $("<h6></h6>").addClass(
    "wp-block-heading has-text-align-center is-style-vk-heading-default",
  );
  heading.append($("<strong></strong>").text(doc.title));

  const readMore = $("<div></div>").addClass(
    "wp-block-buttons is-content-justification-center is-layout-flex wp-container-core-buttons-is-layout-16018d1d wp-block-buttons-is-layout-flex",
  );
  readMore.append(
    $("<div></div>")
      .addClass("wp-block-button detail-btn")
      .append(
        $("<a></a>")
          .addClass("wp-block-button__link wp-element-button")
          .attr("href", doc.href)
          .text("อ่านเพิ่มเติม"),
      ),
  );

  const download = $("<p></p>").addClass("simple-download-counter");
  download.append(
    $("<a></a>")
      .addClass("simple-download-counter-link")
      .attr("data-pdf-reader-ignore", "true")
      .attr("download", "")
      .attr("href", doc.href)
      .text("ดาวน์โหลดไฟล์"),
  );

  column.append(image);
  column.append(heading);
  column.append(readMore);
  column.append(download);
  return column;
}

function buildRailComponentFiles($: cheerio.CheerioAPI): Cheerio<AnyNode> {
  const group = $("<div></div>").addClass(
    "rtrda-rail-component-standards-files wp-block-columns is-layout-flex wp-block-columns-is-layout-flex",
  );
  railComponentDocuments.forEach((doc) => group.append(buildRailComponentCard($, doc)));
  return group;
}

function applyRailComponentStandards(record: WpContentRecord): WpContentRecord {
  const $ = cheerio.load(record.contentHtml, null, false);
  if ($(".rtrda-rail-component-standards-files").length > 0) return record;
  $(".rtrda-rail-component-standards-table").remove();
  const accordion = $(".lightweight-accordion")
    .filter((_, element) =>
      $(element)
        .find("summary")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim()
        .includes("มาตรฐานชิ้นส่วนระบบราง"),
    )
    .first();
  const body = accordion.find(".lightweight-accordion-body").first();
  if (body.length === 0) return record;
  body.prepend(buildRailComponentFiles($));
  return { ...record, contentHtml: $.html() };
}

type RailDocumentCard = {
  title: string;
  image: string;
  previewHref: string;
  downloadHref: string;
};

function buildRailDocumentCards(
  $: cheerio.CheerioAPI,
  markerClass: string,
  documents: RailDocumentCard[],
): Cheerio<AnyNode> {
  const cards = $("<div></div>").addClass(
    [
      markerClass,
      "wp-block-columns",
      "is-layout-flex",
      "wp-block-columns-is-layout-flex",
      documents.length === 1 ? "rtrda-rail-standards-files--single" : "",
    ]
      .filter(Boolean)
      .join(" "),
  );
  documents.forEach((document) => cards.append(buildRailDocumentCard($, document)));
  return cards;
}

function buildRailDocumentCard(
  $: cheerio.CheerioAPI,
  document: RailDocumentCard,
): Cheerio<AnyNode> {
  const column = $("<div></div>").addClass(
    "wp-block-column is-vertically-aligned-top is-layout-flow wp-block-column-is-layout-flow",
  );
  const image = $("<div></div>")
    .addClass("wp-block-image is-style-vk-image-shadow")
    .append(
      $("<figure></figure>")
        .addClass("aligncenter size-full is-resized")
        .append(
          $("<img>")
            .attr("loading", "lazy")
            .attr("decoding", "async")
            .attr("width", "600")
            .attr("height", "852")
            .attr("src", document.image)
            .attr("alt", document.title),
        ),
    );
  const title = $("<h6></h6>")
    .addClass("wp-block-heading has-text-align-center is-style-vk-heading-default")
    .append($("<strong></strong>").text(document.title));
  const readMore = $("<div></div>")
    .addClass(
      "wp-block-buttons is-content-justification-center is-layout-flex wp-container-core-buttons-is-layout-16018d1d wp-block-buttons-is-layout-flex",
    )
    .append(
      $("<div></div>")
        .addClass("wp-block-button detail-btn")
        .append(
          $("<a></a>")
            .addClass("wp-block-button__link wp-element-button")
            .attr("href", document.previewHref)
            .text("อ่านเพิ่มเติม"),
        ),
    );
  const download = $("<p></p>")
    .addClass("simple-download-counter")
    .append(
      $("<a></a>")
        .addClass("simple-download-counter-link")
        .attr("data-pdf-reader-ignore", "true")
        .attr("download", "")
        .attr("href", document.downloadHref)
        .text("ดาวน์โหลดไฟล์"),
    );

  return column.append(image, title, readMore, download);
}

function applyRailDocumentCards(
  record: WpContentRecord,
  accordionTitle: string,
  markerClass: string,
  documents: RailDocumentCard[],
): WpContentRecord {
  const $ = cheerio.load(record.contentHtml, null, false);
  if ($(`.${markerClass}`).length > 0) return record;
  const body = $(".lightweight-accordion")
    .filter((_, element) =>
      $(element)
        .find("summary")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim()
        .includes(accordionTitle),
    )
    .first()
    .find(".lightweight-accordion-body")
    .first();
  if (body.length === 0) return record;

  body.empty().append(buildRailDocumentCards($, markerClass, documents));
  return { ...record, contentHtml: $.html() };
}

function buildRailStandardsCard(
  $: cheerio.CheerioAPI,
  document: { title: string; href: string; image: string },
): Cheerio<AnyNode> {
  const column = $("<div></div>").addClass(
    "wp-block-column is-vertically-aligned-top is-layout-flow wp-block-column-is-layout-flow",
  );
  const image = $("<div></div>")
    .addClass("wp-block-image is-style-vk-image-shadow")
    .append(
      $("<figure></figure>")
        .addClass("aligncenter size-full is-resized")
        .append(
          $("<img>")
            .attr("loading", "lazy")
            .attr("decoding", "async")
            .attr("width", "600")
            .attr("height", "848")
            .attr("src", document.image)
            .attr("alt", document.title)
            .attr(
              "style",
              "aspect-ratio:0.7075471698113207;object-fit:cover;width:165px;height:auto",
            ),
        ),
    );
  const title = $("<h6></h6>")
    .addClass("wp-block-heading has-text-align-center is-style-vk-heading-default")
    .append($("<strong></strong>").text(document.title));
  const readMore = $("<div></div>")
    .addClass(
      "wp-block-buttons is-content-justification-center is-layout-flex wp-container-core-buttons-is-layout-16018d1d wp-block-buttons-is-layout-flex",
    )
    .append(
      $("<div></div>")
        .addClass("wp-block-button detail-btn")
        .append(
          $("<a></a>")
            .addClass("wp-block-button__link wp-element-button")
            .attr("href", document.href)
            .attr("target", "_blank")
            .attr("rel", "noreferrer noopener")
            .text("อ่านเพิ่มเติม"),
        ),
    );
  const download = $("<p></p>")
    .addClass("simple-download-counter")
    .append(
      $("<a></a>")
        .addClass("simple-download-counter-link")
        .attr("data-pdf-reader-ignore", "true")
        .attr("download", "")
        .attr("href", document.href)
        .text("ดาวน์โหลดไฟล์"),
    );

  column.append(image, title, readMore, download);
  return column;
}

function buildRailStandardsCards(
  $: cheerio.CheerioAPI,
  documents: Array<{ title: string; href: string; image: string }>,
): Cheerio<AnyNode> {
  const cards = $("<div></div>").addClass(
    [
      "rtrda-rail-standards-files",
      documents.length === 1 ? "rtrda-rail-standards-files--single" : "",
      "wp-block-columns",
      "is-layout-flex",
      "wp-block-columns-is-layout-flex",
    ]
      .filter(Boolean)
      .join(" "),
  );
  documents.forEach((document) => cards.append(buildRailStandardsCard($, document)));
  return cards;
}

function buildRailStandardsAccordion(
  $: cheerio.CheerioAPI,
  title: string,
  documents: Array<{ title: string; href: string; image: string }>,
): Cheerio<AnyNode> {
  const accordion = $("<div></div>").addClass("lightweight-accordion");
  const details = $("<details></details>");
  details.append(
    $("<summary></summary>")
      .addClass("lightweight-accordion-title")
      .append($("<strong></strong>").text(title)),
  );
  details.append(
    $("<div></div>")
      .addClass("lightweight-accordion-body")
      .append(buildRailStandardsCards($, documents)),
  );
  accordion.append(details);
  return accordion;
}

function applyRailStandardsTables(record: WpContentRecord): WpContentRecord {
  const $ = cheerio.load(record.contentHtml, null, false);
  if ($(".rtrda-rail-standards-files").length > 0) return record;

  const tables = [
    buildRailStandardsAccordion(
      $,
      "แผนพัฒนามาตรฐานระบบขนส่งทางราง",
      railDevelopmentPlanDocuments,
    ),
    buildRailStandardsAccordion(
      $,
      "ประมวลมาตรฐานระบบขนส่งทางราง",
      railStandardsCompilationDocuments,
    ),
  ];
  const highSpeedRailAccordion = $(".lightweight-accordion")
    .filter((_, element) =>
      $(element)
        .find("summary")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim()
        .includes("มาตรฐานโครงการรถไฟความเร็วสูง"),
    )
    .first();

  if (highSpeedRailAccordion.length > 0) {
    tables.forEach((table) => highSpeedRailAccordion.before(table));
  } else {
    tables.forEach((table) => $.root().append(table));
  }
  return { ...record, contentHtml: $.html() };
}

export function applyProcurementTableOverrides(record: WpContentRecord): WpContentRecord {
  const path = normalized(record.path);
  if (path === QUARTERLY_WINNER_PATH || path === `/en${QUARTERLY_WINNER_PATH}`) {
    return applyQuarterlyWinnerRows(record);
  }
  if (path === PROCUREMENT_SUMMARY_PATH || path === `/en${PROCUREMENT_SUMMARY_PATH}`) {
    return applyYearTableRows(record, summaryRows);
  }
  if (path === PROCUREMENT_WINNER_PATH || path === `/en${PROCUREMENT_WINNER_PATH}`) {
    return applyWinnerRows(record);
  }
  if (
    path === PROCUREMENT_CANCEL_WINNER_PATH ||
    path === `/en${PROCUREMENT_CANCEL_WINNER_PATH}`
  ) {
    return applyEmptyCancelWinnerTable(record);
  }
  if (path === RAIL_STANDARDS_PATH || path === `/en${RAIL_STANDARDS_PATH}`) {
    return applyRailStandardsTables(
      applyRailDocumentCards(
        applyRailDocumentCards(
          applyRailComponentStandards(record),
          "มาตรฐานงานเชื่อม",
          "rtrda-rail-welding-files",
          railWeldingDocuments,
        ),
        "อื่นๆ",
        "rtrda-other-rail-standard-files",
        otherRailStandardDocuments,
      ),
    );
  }
  return record;
}
