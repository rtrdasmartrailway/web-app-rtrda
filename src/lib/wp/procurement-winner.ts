import * as cheerio from "cheerio";
import type { Cheerio } from "cheerio";
import type { AnyNode } from "domhandler";
import type { WpContentRecord } from "./types";
import { normalizeRoutePath } from "./url";

const PROCUREMENT_WINNER_PATH = "/จัดซื้อจัดจ้าง/ประกาศผลผู้ชนะการเสนอร";
const PROCUREMENT_WINNER_YEAR = "ปี 2569";

const NEW_WINNER_ROW = {
  date: "25 มิถุนายน 2569",
  project:
    "เรื่อง ประกาศผู้ชนะการเสนอราคา จัดซื้อซอฟต์แวร์การออกแบบใช้คอมพิวเตอร์ช่วย (CAD Computer Aided Design) ด้วยโปรแกรม CATIA พร้อมติดตั้ง โดยวิธีประกวดราคาอิเล็กทรอนิกส์ (e-bidding)",
  budget: "1,342,927.58",
  documentNo: "–",
  documentHref: "/wp-content/uploads/2026/06/ประกาศแผนแพร่แผนการจัดซื้อจัดจ้าง_0001.pdf",
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

  if (tbody.length === 0 || isAlreadyInserted($, tbody)) {
    return record;
  }

  tbody.prepend(buildWinnerRow($));
  tbody.find("tr").each((index, row) => {
    $(row)
      .find("td")
      .first()
      .text(String(index + 1));
  });

  return {
    ...record,
    contentHtml: $.html(),
  };
}
