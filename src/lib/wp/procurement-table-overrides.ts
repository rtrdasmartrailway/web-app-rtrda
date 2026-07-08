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

function upsertRows(
  $: cheerio.CheerioAPI,
  tbody: Cheerio<AnyNode>,
  rows: TableRowSpec[],
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

  tbody.find("tr").each((index, row) => {
    const first = $(row).find("td").first();
    const nextNumber = String(index + 1);
    if (first.text().trim() !== nextNumber) {
      first.text(nextNumber);
      changed = true;
    }
  });

  return changed;
}

function applyYearTableRows(
  record: WpContentRecord,
  rows: TableRowSpec[],
): WpContentRecord {
  const $ = cheerio.load(record.contentHtml, null, false);
  const changed = upsertRows($, findYearTable($, YEAR_2569), rows);
  return changed ? { ...record, contentHtml: $.html() } : record;
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

function buildRailComponentCard(
  $: cheerio.CheerioAPI,
  doc: { code: string; title: string; href: string; image: string },
): Cheerio<AnyNode> {
  const column = $("<article></article>")
    .addClass(
      "rtrda-rail-component-card wp-block-column is-vertically-aligned-top is-layout-flow wp-block-column-is-layout-flow",
    )
    .attr(
      "style",
      "background:#ffffff;border-radius:18px;box-shadow:0 12px 30px rgba(15,23,42,.10);padding:22px 18px 20px;display:flex;flex-direction:column;align-items:center;gap:14px;min-height:100%;",
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
            .attr("alt", `สทร. ${doc.code} ${doc.title}`)
            .attr("style", "width:165px;height:auto;max-width:100%;border-radius:10px;"),
        ),
    );

  const heading = $("<h6></h6>").addClass(
    "wp-block-heading has-text-align-center is-style-vk-heading-default",
  );
  heading.append($("<strong></strong>").text(`สทร. ${doc.code}`));
  heading.append($("<br>"));
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
  const group = $("<div></div>")
    .addClass("rtrda-rail-component-standards-files")
    .attr(
      "style",
      "display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:24px;align-items:stretch;margin:24px 0;",
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

export function applyProcurementTableOverrides(record: WpContentRecord): WpContentRecord {
  const path = normalized(record.path);
  if (path === QUARTERLY_WINNER_PATH || path === `/en${QUARTERLY_WINNER_PATH}`) {
    return applyQuarterlyWinnerRows(record);
  }
  if (path === PROCUREMENT_SUMMARY_PATH || path === `/en${PROCUREMENT_SUMMARY_PATH}`) {
    return applyYearTableRows(record, summaryRows);
  }
  if (path === PROCUREMENT_WINNER_PATH || path === `/en${PROCUREMENT_WINNER_PATH}`) {
    return applyYearTableRows(record, winnerRows);
  }
  if (path === RAIL_STANDARDS_PATH || path === `/en${RAIL_STANDARDS_PATH}`) {
    return applyRailComponentStandards(record);
  }
  return record;
}
