import * as cheerio from "cheerio";
import type { WpContentRecord } from "./types";
import { normalizeRoutePath } from "./url";

const CONTACT_INFORMATION_PATH = "/ติดต่อเรา/ช่องทางการติดต่อ";

export const RTRDA_CONTACT_MAP_EMBED_URL =
  "https://www.google.com/maps?q=13.7505783,100.5681343&z=18&output=embed";

function isContactInformationPath(path: string): boolean {
  return normalizeRoutePath(path).replace(/^\/en(?=\/)/, "") === CONTACT_INFORMATION_PATH;
}

export function applyContactMapOverride(record: WpContentRecord): WpContentRecord {
  if (!isContactInformationPath(record.path)) {
    return record;
  }

  const $ = cheerio.load(record.contentHtml, null, false);
  const mapIframes = $('iframe[src*="google.com/maps"]');
  if (mapIframes.length === 0) {
    return record;
  }

  mapIframes.attr("src", RTRDA_CONTACT_MAP_EMBED_URL);
  mapIframes.attr(
    "title",
    record.language === "th" ? "แผนที่ตั้ง สทร." : "RTRDA location map",
  );

  return {
    ...record,
    contentHtml: $.html(),
  };
}
