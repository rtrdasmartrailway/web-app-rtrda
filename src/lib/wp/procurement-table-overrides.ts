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

const driveFile = (id: string) =>
  `https://drive.google.com/file/d/${id}/view?usp=sharing`;

const quarterlyRows: TableRowSpec[] = [
  {
    matchText: "ประกาศผลผู้ชนะการจัดซื้อจัดจ้างหรือผู้ได้รับการคัดเลือก ประจำไตรมาสที่ 3",
    cells: [
      "7 กรกฎาคม 2569",
      "ประกาศผลผู้ชนะการจัดซื้อจัดจ้างหรือผู้ได้รับการคัดเลือก ประจำไตรมาสที่ 3 (เดือนเมษายน 2569 ถึง เดือน มีนาคม 2569)",
      PUBLISHED_STATUS,
    ],
    href: driveFile("1v73P5MMqr8AJ7DtF4qxJsQFUBWNaq2qF"),
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
    href: driveFile("1kc6J9_3a_IA1DQXS245h5R32TecRDjAv"),
  },
  {
    matchText: "11 มิถุนายน 2569 สรุปผลการดำเนินการจัดซื้อจัดจ้างในรอบเดือน มิถุนายน",
    cells: [
      "11 มิถุนายน 2569",
      "สรุปผลการดำเนินการจัดซื้อจัดจ้างในรอบเดือน มิถุนายน",
      PUBLISHED_STATUS,
    ],
    href: driveFile("19rhsPO3tpJueBhylgP7pp5uf6zMKuPx1"),
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
    href: driveFile("1jA1NXPjKbMVR2T1qYEr0Cuanl4xac1Q3"),
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
    href: driveFile("1oludIzLDYwph6rAtsVHtNWjd-zM6M0Zk"),
  },
];

const railComponentDocuments: Array<{ title: string; href: string }> = [
  {
    title: "สทร. CT-(2002-2005)-2569 ชุดมาตรฐานอุปกรณ์ยึดเหนี่ยวราง.pdf",
    href: driveFile("1VJLz1OpKb9pwDzkSXEmrQ8UKzFoLety4"),
  },
  {
    title: "สทร. CT-(2006-2010)-2569 ชุดมาตรฐานหมอนคอนกรีตและหมอนประแจคอนกรีต.pdf",
    href: driveFile("1dbuyeXGw079pp4BiUVaAyj7zrbVT80_9"),
  },
  {
    title: "สทร. CT-(6005-6014)-2569 ชุดมาตรฐานการทดสอบอุปกรณ์ยึดเหนี่ยวราง.pdf",
    href: driveFile("1DQx-KwXtAuClpG4IfUiPyh-ZMr_CZ0Jc"),
  },
  {
    title: "สทร. CT-1001-2569 มาตรฐานการออกแบบหมอนคอนกรีตและหมอนประแจคอนกรีต.pdf",
    href: driveFile("1B99Ex18eG0ji4qhqmjZ2xNLq6iypPm3s"),
  },
  {
    title:
      "สทร. CT-8001-2569 มาตรฐานบทนิยามเกี่ยวกับหมอนรองรางและอุปกรณ์ยึดเหนี่ยวราง.pdf",
    href: driveFile("1pWuvw5B7xi8Pm9xJfuJuy-kZQbO8bp_P"),
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

function buildRailComponentTable($: cheerio.CheerioAPI): Cheerio<AnyNode> {
  const table = $("<figure></figure>").addClass(
    "wp-block-table rtrda-rail-component-standards-table",
  );
  const tableEl = $("<table></table>");
  const thead = $(
    "<thead><tr><th>ลำดับ</th><th>รายการมาตรฐานชิ้นส่วนระบบราง</th><th>เอกสาร</th></tr></thead>",
  );
  const tbody = $("<tbody></tbody>");
  railComponentDocuments.forEach((doc, index) => {
    const tr = $("<tr></tr>");
    tr.append(td($, String(index + 1)));
    tr.append(td($, doc.title));
    const linkCell = td($, "");
    linkCell.append(
      $("<a></a>")
        .attr("href", doc.href)
        .attr("target", "_blank")
        .attr("rel", "noreferrer noopener")
        .text("PDF"),
    );
    tr.append(linkCell);
    tbody.append(tr);
  });
  tableEl.append(thead).append(tbody);
  table.append(tableEl);
  return table;
}

function applyRailComponentStandards(record: WpContentRecord): WpContentRecord {
  const $ = cheerio.load(record.contentHtml, null, false);
  if ($(".rtrda-rail-component-standards-table").length > 0) return record;
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
  body.prepend(buildRailComponentTable($));
  return { ...record, contentHtml: $.html() };
}

export function applyProcurementTableOverrides(record: WpContentRecord): WpContentRecord {
  const path = normalized(record.path);
  if (path === QUARTERLY_WINNER_PATH || path === `/en${QUARTERLY_WINNER_PATH}`) {
    return applyYearTableRows(record, quarterlyRows);
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
