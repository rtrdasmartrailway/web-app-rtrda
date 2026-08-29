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
const PICHET_NAMES = new Set([
  "ดร.พิเชฐ คุณาธรรมรักษ์",
  "ดร. พิเชฐ คุณาธรรมรักษ์",
  "Dr. Pichet Kunadhamraks",
]);
const PATTANAPHONG_NAMES = new Set([
  "พัฒนพงษ์ พงศ์ศุภสมิทธิ์",
  "Pattanaphong Phongsupatsamit",
]);
const PIANG_OR_NAMES = new Set([
  "ดร. เพียงออ เลาหะวิไลย",
  "ดร.เพียงออ เลาหะวิไลย",
  "Dr. Piang-or Loahavilai",
]);
const THAVORN_NAMES = new Set(["ถาวร ชลัษเฐียร", "Thavorn Chalassathien"]);

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isBoardExecutivePath(record: WpContentRecord): boolean {
  const path = normalizeRoutePath(record.path).normalize("NFC");
  return path === BOARD_EXECUTIVES_PATH || path === `/en${BOARD_EXECUTIVES_PATH}`;
}

function rewritePichetColumn(
  $: cheerio.CheerioAPI,
  element: AnyNode,
  language: WpContentRecord["language"],
): boolean {
  const column = $(element);
  if (!PICHET_NAMES.has(compactText(column.find("h4").first().text()))) {
    return false;
  }

  const role = column.find("h5").first();
  role.empty();
  if (language === "en") {
    role.append(
      "Member, Board of Director<br>Director-General, Department of Rail Transport",
    );
  } else {
    role.append("กรรมการ<br>อธิบดีกรมการขนส่งทางราง");
  }

  return true;
}

function rewritePattanaphongColumn(
  $: cheerio.CheerioAPI,
  element: AnyNode,
  language: WpContentRecord["language"],
): boolean {
  const column = $(element);
  if (!PATTANAPHONG_NAMES.has(compactText(column.find("h4").first().text()))) {
    return false;
  }

  const role = column.find("h5").first();
  role.empty();
  if (language === "en") {
    role.append(
      "Member, Board of Director<br>Deputy Governor (Administration)<br>Mass Transit Railway Authority of Thailand",
    );
  } else {
    role.append("กรรมการ<br>รองผู้ว่าการ รฟม. (บริหาร)<br>ผู้แทนผู้ว่าการ รฟม.");
  }

  return true;
}

function rewritePiangOrColumn(
  $: cheerio.CheerioAPI,
  element: AnyNode,
  language: WpContentRecord["language"],
): boolean {
  const column = $(element);
  if (!PIANG_OR_NAMES.has(compactText(column.find("h4").first().text()))) {
    return false;
  }

  const role = column.find("h5").first();
  role.empty();
  role.append(language === "en" ? "Member &amp; Secretary" : "กรรมการและเลขานุการฯ");
  return true;
}

function removeThavornColumn($: cheerio.CheerioAPI, element: AnyNode): boolean {
  const column = $(element);
  if (!THAVORN_NAMES.has(compactText(column.find("h4").first().text()))) {
    return false;
  }

  column.remove();
  return true;
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
  if (!isBoardExecutivePath(record)) {
    return record;
  }

  const $ = cheerio.load(record.contentHtml, null, false);
  const columns = $(".lightweight-accordion .wp-block-column").toArray();
  const didRewritePichet = columns.some((element) =>
    rewritePichetColumn($, element, record.language),
  );
  const didRewritePattanaphong = columns.some((element) =>
    rewritePattanaphongColumn($, element, record.language),
  );
  const didRewritePiangOr = columns.some((element) =>
    rewritePiangOrColumn($, element, record.language),
  );
  const didRemoveThavorn = columns.some((element) => removeThavornColumn($, element));
  const didRewriteResearch =
    record.language === "th" &&
    columns.some((element) => rewriteTargetColumn($, element));
  const didRewriteAdmin =
    record.language === "th" && columns.some((element) => rewriteAdminColumn($, element));

  if (
    !didRewritePichet &&
    !didRewritePattanaphong &&
    !didRewritePiangOr &&
    !didRemoveThavorn &&
    !didRewriteResearch &&
    !didRewriteAdmin
  ) {
    return record;
  }

  return {
    ...record,
    contentHtml: $.html(),
  };
}
