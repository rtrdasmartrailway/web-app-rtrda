import * as cheerio from "cheerio";
import type { WpContentRecord } from "./types";
import { normalizeRoutePath } from "./url";

const PROCUREMENT_PLAN_PATH = "/จัดซื้อจัดจ้าง/แผนการจัดซื้อจัดจ้าง";
const PROCUREMENT_PLAN_YEAR = "ปี 2569";

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

  rows.each((index, row) => {
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
