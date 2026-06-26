import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { WpContentRecord } from "./types";
import { normalizeRoutePath } from "./url";

const BOARD_EXECUTIVES_PATH = "/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร";
const TARGET_ROLE = "ผู้จัดการกลุ่มวิจัยและมาตรฐาน";
const OLD_NAME = "ดร.กิติพันธุ์ นุตยกุล";
const NEW_NAME = "ธัชกร ธนวัฒนาดำรง";
const NEW_EMAIL = "touchakorn.t@rtrda.or.th";
export const TACHAKORN_IMAGE_SRC =
  "/wp-content/uploads/2025/10/ธัชกร-ธนวัฒนาดำรง-ผู้จัดการกลุ่มวิจัยและมาตรฐาน.jpg";
const ADMIN_ROLE = "ผู้จัดการกลุ่มบริหารภายใน";
const ADMIN_ROLE_DISPLAY = "ผู้จัดการกลุ่มบริหารภายใน (รักษาการแทน)";
export const CHAIYUT_NAME = "ชัยวุฒิ ตันไชย";
const CHAIYUT_EMAIL = "chaiwooth.t@rtrda.or.th";
export const CHAIYUT_IMAGE_SRC =
  "/wp-content/uploads/2025/10/ชัยวุฒิ-ตันไชย-ผู้จัดการกลุ่มพัฒนาผู้ประกอบการและธุรกิจใหม่.jpg";

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isThaiBoardExecutivePath(record: WpContentRecord): boolean {
  return (
    record.language === "th" &&
    normalizeRoutePath(record.path).normalize("NFC") === BOARD_EXECUTIVES_PATH
  );
}

function rewriteTargetColumn($: cheerio.CheerioAPI, element: AnyNode): boolean {
  const column = $(element);
  const heading = column.find("h4").first();

  if (compactText(heading.text()) !== OLD_NAME) {
    return false;
  }

  const image = column.find("img").first();
  image.attr("src", TACHAKORN_IMAGE_SRC);
  image.attr("alt", NEW_NAME);
  image.removeAttr("srcset");
  image.removeAttr("sizes");

  heading.text(NEW_NAME);

  const role = column.find("h5").first();
  role.empty();
  role.append(`${TARGET_ROLE}<br>`);
  role.append("อีเมล: ");
  role.append(`<a href="mailto:${NEW_EMAIL}">${NEW_EMAIL}</a>`);

  return true;
}

function rewriteAdminColumn($: cheerio.CheerioAPI, element: AnyNode): boolean {
  const column = $(element);
  const role = column.find("h5").first();

  if (!role.text().includes(ADMIN_ROLE)) {
    return false;
  }

  const image = column.find("img").first();
  image.attr("src", CHAIYUT_IMAGE_SRC);
  image.attr("alt", CHAIYUT_NAME);
  image.removeAttr("srcset");
  image.removeAttr("sizes");

  const heading = column.find("h4").first();
  heading.text(CHAIYUT_NAME);

  role.empty();
  role.append(ADMIN_ROLE_DISPLAY);
  role.append("<br>");
  role.append("อีเมล: ");
  role.append(`<a href="mailto:${CHAIYUT_EMAIL}">${CHAIYUT_EMAIL}</a>`);

  return true;
}

export function applyBoardExecutiveOverride(record: WpContentRecord): WpContentRecord {
  if (!isThaiBoardExecutivePath(record)) {
    return record;
  }

  const $ = cheerio.load(record.contentHtml, null, false);
  const columns = $(".lightweight-accordion .wp-block-column").toArray();
  const didRewriteResearch = columns.some((element) => rewriteTargetColumn($, element));
  const didRewriteAdmin = columns.some((element) => rewriteAdminColumn($, element));

  if (!didRewriteResearch && !didRewriteAdmin) {
    return record;
  }

  return {
    ...record,
    contentHtml: $.html(),
  };
}
