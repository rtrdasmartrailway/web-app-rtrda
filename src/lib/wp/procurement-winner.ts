import * as cheerio from "cheerio";
import type { Cheerio } from "cheerio";
import type { AnyNode } from "domhandler";
import type { WpContentRecord } from "./types";
import { normalizeRoutePath } from "./url";

const PROCUREMENT_WINNER_PATH = "/จัดซื้อจัดจ้าง/ประกาศผลผู้ชนะการเสนอร";
const PROCUREMENT_WINNER_YEAR = "ปี 2569";

const WINNER_DOCUMENT_HREF_25_JUNE_2569 =
  "/wp-content/uploads/2026/06/ประกาศผู้ชนะการเสนอราคา_25_06_2569.pdf";
const WINNER_DOCUMENT_HREF_6_MAY_2569 =
  "/wp-content/uploads/2026/05/ประกาศผู้ชนะการเสนอราคา_12_05_2569.pdf";
const WINNER_DOCUMENT_HREF_10_JULY_2569 =
  "/wp-content/uploads/2026/07/procurement-winner-rtrda-5th-anniversary-25690710.pdf";

const NEW_WINNER_ROWS = [
  {
    date: "10 กรกฎาคม 2569",
    project:
      "เรื่อง ประกาศผู้ชนะการเสนอราคา จ้างเหมาบริการจัดงานพิธีทำบุญวันสถาปนา สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) ครบรอบ 5 ปี โดยวิธีเฉพาะเจาะจง",
    budget: "250,000.00",
    documentNo: "–",
    documentHref: WINNER_DOCUMENT_HREF_10_JULY_2569,
  },
  {
    date: "25 มิถุนายน 2569",
    project:
      "เรื่อง ประกาศผู้ชนะการเสนอราคา จัดซื้อซอฟต์แวร์การออกแบบใช้คอมพิวเตอร์ช่วย (CAD Computer Aided Design) ด้วยโปรแกรม CATIA พร้อมติดตั้ง โดยวิธีประกวดราคาอิเล็กทรอนิกส์ (e-bidding)",
    budget: "1,342,927.58",
    documentNo: "–",
    documentHref: WINNER_DOCUMENT_HREF_25_JUNE_2569,
  },
];

function isProcurementWinnerPath(path: string): boolean {
  return normalizeRoutePath(path) === PROCUREMENT_WINNER_PATH;
}

function cell($: cheerio.CheerioAPI, text: string): Cheerio<AnyNode> {
  return $("<td></td>")
    .addClass("has-text-align-center")
    .attr("data-align", "center")
    .text(text);
}

function buildWinnerRow(
  $: cheerio.CheerioAPI,
  rowSpec: (typeof NEW_WINNER_ROWS)[number],
): Cheerio<AnyNode> {
  const row = $("<tr></tr>");
  const documentCell = cell($, "");
  const documentLink = $("<a></a>").attr("href", rowSpec.documentHref).text("PDF");

  row.append(cell($, ""));
  row.append(cell($, rowSpec.date));
  row.append(cell($, rowSpec.project));
  row.append(cell($, rowSpec.budget));
  row.append(cell($, rowSpec.documentNo));
  documentCell.append(documentLink);
  row.append(documentCell);
  return row;
}

function isAlreadyInserted(
  $: cheerio.CheerioAPI,
  tbody: Cheerio<AnyNode>,
  rowSpec: (typeof NEW_WINNER_ROWS)[number],
): boolean {
  return tbody
    .find("tr")
    .toArray()
    .some((row) => {
      const text = $(row).text();
      return (
        text.includes(rowSpec.date) &&
        text.includes(rowSpec.project) &&
        text.includes(rowSpec.budget)
      );
    });
}

function renumberRowsBottomUp($: cheerio.CheerioAPI, tbody: Cheerio<AnyNode>): boolean {
  let changed = false;
  const rows = tbody.find("tr").toArray();

  rows.forEach((row, index) => {
    const nextNumber = String(rows.length - index);
    const firstCell = $(row).find("td").first();
    if (firstCell.text().trim() !== nextNumber) {
      firstCell.text(nextNumber);
      changed = true;
    }
  });

  return changed;
}

function setRowDocumentHref(
  $: cheerio.CheerioAPI,
  row: AnyNode,
  expectedHref: string,
): boolean {
  const link = $(row).find("td").last().find("a").first();

  if (link.length === 0 || link.attr("href") === expectedHref) {
    return false;
  }

  link.attr("href", expectedHref);
  return true;
}

function updateWinnerDocumentLinks(
  $: cheerio.CheerioAPI,
  tbody: Cheerio<AnyNode>,
): boolean {
  let changed = false;

  tbody.find("tr").each((_, row) => {
    const rowText = $(row).text().replace(/\s+/g, " ").trim();

    if (
      rowText.includes("25 มิถุนายน 2569") &&
      rowText.includes("จัดซื้อซอฟต์แวร์การออกแบบใช้คอมพิวเตอร์ช่วย")
    ) {
      changed = setRowDocumentHref($, row, WINNER_DOCUMENT_HREF_25_JUNE_2569) || changed;
      return;
    }

    if (rowText.includes("6 พฤษภาคม 2569") && rowText.includes("7,999,000.00")) {
      changed = setRowDocumentHref($, row, WINNER_DOCUMENT_HREF_6_MAY_2569) || changed;
    }
  });

  return changed;
}

export function applyProcurementWinnerOverride(record: WpContentRecord): WpContentRecord {
  if (!isProcurementWinnerPath(record.path)) {
    return record;
  }

  const $ = cheerio.load(record.contentHtml, null, false);
  const accordion = $(".lightweight-accordion")
    .filter((_, element) =>
      $(element).find("summary").first().text().trim().includes(PROCUREMENT_WINNER_YEAR),
    )
    .first();
  const tbody = accordion.find("tbody").first();

  if (tbody.length === 0) {
    return record;
  }

  let changed = false;

  for (const rowSpec of [...NEW_WINNER_ROWS].reverse()) {
    if (!isAlreadyInserted($, tbody, rowSpec)) {
      tbody.prepend(buildWinnerRow($, rowSpec));
      changed = true;
    }
  }

  changed = renumberRowsBottomUp($, tbody) || changed;
  changed = updateWinnerDocumentLinks($, tbody) || changed;

  if (!changed) {
    return record;
  }

  return {
    ...record,
    contentHtml: $.html(),
  };
}
