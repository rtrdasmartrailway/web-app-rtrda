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

const NEW_WINNER_ROW = {
  date: "25 มิถุนายน 2569",
  project:
    "เรื่อง ประกาศผู้ชนะการเสนอราคา จัดซื้อซอฟต์แวร์การออกแบบใช้คอมพิวเตอร์ช่วย (CAD Computer Aided Design) ด้วยโปรแกรม CATIA พร้อมติดตั้ง โดยวิธีประกวดราคาอิเล็กทรอนิกส์ (e-bidding)",
  budget: "1,342,927.58",
  documentNo: "–",
  documentHref: WINNER_DOCUMENT_HREF_25_JUNE_2569,
};

function isProcurementWinnerPath(path: string): boolean {
  return normalizeRoutePath(path) === PROCUREMENT_WINNER_PATH;
}

function cell($: cheerio.CheerioAPI, text: string): Cheerio<AnyNode> {
  return $("<td></td>")
    .addClass("has-text-align-center")
    .attr("data-align", "center")
    .text(text);
}

function buildWinnerRow($: cheerio.CheerioAPI): Cheerio<AnyNode> {
  const row = $("<tr></tr>");
  const documentCell = cell($, "");
  const documentLink = $("<a></a>").attr("href", NEW_WINNER_ROW.documentHref).text("PDF");

  row.append(cell($, "1"));
  row.append(cell($, NEW_WINNER_ROW.date));
  row.append(cell($, NEW_WINNER_ROW.project));
  row.append(cell($, NEW_WINNER_ROW.budget));
  row.append(cell($, NEW_WINNER_ROW.documentNo));
  documentCell.append(documentLink);
  row.append(documentCell);
  return row;
}

function isAlreadyInserted($: cheerio.CheerioAPI, tbody: Cheerio<AnyNode>): boolean {
  const firstRowText = tbody.find("tr").first().text();
  return (
    firstRowText.includes(NEW_WINNER_ROW.date) &&
    firstRowText.includes(NEW_WINNER_ROW.project) &&
    firstRowText.includes(NEW_WINNER_ROW.budget)
  );
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

  if (!isAlreadyInserted($, tbody)) {
    tbody.prepend(buildWinnerRow($));
    tbody.find("tr").each((index, row) => {
      $(row)
        .find("td")
        .first()
        .text(String(index + 1));
    });
    changed = true;
  }

  changed = updateWinnerDocumentLinks($, tbody) || changed;

  if (!changed) {
    return record;
  }

  return {
    ...record,
    contentHtml: $.html(),
  };
}
