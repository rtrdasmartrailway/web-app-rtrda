import * as cheerio from "cheerio";
import type { WpContentRecord } from "./types";
import { normalizeRoutePath } from "./url";

const PROCUREMENT_PLAN_PATH = "/จัดซื้อจัดจ้าง/แผนการจัดซื้อจัดจ้าง";
const PROCUREMENT_PLAN_YEAR = "ปี 2569";
const PROCUREMENT_PLAN_DOCUMENT_HREF_16_JULY_2569 =
  "/wp-content/uploads/2026/07/ประกาศแผนจัดซื้อจัดจ้าง_17_07_2569.pdf?v=20260717";
const PROCUREMENT_PLAN_ROW_16_JULY_2569 = {
  date: "16 กรกฎาคม 2569",
  project: "เผยแพร่แผนการจัดซื้อจัดจ้าง ประจำปีงบประมาณ พ.ศ. 2569",
};

function isProcurementPlanPath(path: string): boolean {
  return normalizeRoutePath(path) === PROCUREMENT_PLAN_PATH;
}

export function applyProcurementPlanOverride(record: WpContentRecord): WpContentRecord {
  if (!isProcurementPlanPath(record.path)) {
    return record;
  }

  const $ = cheerio.load(record.contentHtml, null, false);
  const accordion = $(".lightweight-accordion")
    .filter((_, element) =>
      $(element).find("summary").first().text().trim().includes(PROCUREMENT_PLAN_YEAR),
    )
    .first();

  const rows = accordion.find("tbody tr");
  if (rows.length === 0) {
    return record;
  }

  const existingRow = rows
    .filter((_, row) => $(row).text().includes(PROCUREMENT_PLAN_ROW_16_JULY_2569.project))
    .first();
  let changed = false;
  if (existingRow.length === 0) {
    const row = $("<tr></tr>");
    row.append($("<td></td>"));
    row.append($("<td></td>").text(PROCUREMENT_PLAN_ROW_16_JULY_2569.date));
    row.append($("<td></td>").text(PROCUREMENT_PLAN_ROW_16_JULY_2569.project));
    row.append($("<td></td>").text("เผยแพร่ขึ้นเว็บ"));
    row.append(
      $("<td></td>").append(
        $("<a></a>")
          .attr("href", PROCUREMENT_PLAN_DOCUMENT_HREF_16_JULY_2569)
          .attr("target", "_blank")
          .attr("rel", "noreferrer noopener")
          .text("PDF"),
      ),
    );
    rows.first().before(row);
    changed = true;
  }

  accordion.find("tbody tr").each((index, row) => {
    const firstCell = $(row).find("td").first();
    const nextNumber = String(index + 1);
    if (firstCell.text().trim() !== nextNumber) {
      firstCell.text(nextNumber);
      changed = true;
    }
  });

  if (!changed) return record;

  return {
    ...record,
    contentHtml: $.html(),
  };
}
