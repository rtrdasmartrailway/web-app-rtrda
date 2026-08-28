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
  "Pattanaphong Phongnsupatsamit",
]);
const PIANG_OR_NAMES = new Set([
  "ดร. เพียงออ เลาหะวิไลย",
  "ดร.เพียงออ เลาหะวิไลย",
  "Dr. Piang-or Loahavilai",
]);
const THAVORN_NAMES = new Set(["ถาวร ชลัษเฐียร", "Thavorn Chalassathien"]);
const REPRESENTATIVE_RAILWAY_NAMES = new Set([
  "ผู้แทน ผู้ว่าการรถไฟแห่งประเทศไทย",
  "ดร. วีรเดช ชีวาพัฒนานุวงศ์",
  "Dr. Weeradet Cheevapattananuwong",
]);
export const ANAN_IMAGE_SRC = "/wp-content/uploads/2026/08/anan-pho-nimdaeng.png";
const REPRESENTATIVE_MINISTRY_NAME =
  "ผู้แทน กระทรวงการอุดมศึกษา วิทยาศาสตร์ วิจัยและนวัตกรรม";
const REPRESENTATIVE_MINISTRY_NAME_EN =
  "Representative of the Ministry of Higher Education, Science, Research and Innovation";
const REMOVED_BOARD_NAMES = new Set([
  "ดร. จุลเทพ ขจรไชยกูล",
  "ดร.จุลเทพ ขจรไชยกูล",
  "วัชรชาญ สิริสุวรรณทัศน์",
  "Watcharachan Sirisuwannatash",
]);
export const WATCHARACHAN_IMAGE_SRC =
  "/wp-content/uploads/2026/08/watcharachan-sirisuwannatat.png";
export const WEERADET_IMAGE_SRC =
  "/wp-content/uploads/2026/08/weeradet-cheevapattananuwong.jpg";
const BOARD_CARD_ORDER: Record<WpContentRecord["language"], string[]> = {
  th: [
    "รศ.ดร. โชติชัย เจริญงาม",
    "ดรุณ แสงฉาย",
    "ชาญเชาวน์ ไชยานุกิจ",
    "ผศ. พิศิษฐ์ แสง-ชูโต",
    "ดร. วีรเดช ชีวาพัฒนานุวงศ์",
    "วัชรชาญ สิริสุวรรณทัศน์",
    "ดร. พิเชฐ คุณาธรรมรักษ์",
    "นายอนันต์ โพธิ์นิ่มแดง",
    "พัฒนพงษ์ พงศ์ศุภสมิทธิ์",
  ],
  en: [
    "Assoc. Prof. Dr. Chotchai Charoenngam",
    "Darun Saengshine",
    "Chanchao Chaiyanukij",
    "Asst. Prof. Pisit Saeng-Xuto",
    "Dr. Weeradet Cheevapattananuwong",
    REPRESENTATIVE_MINISTRY_NAME_EN,
    "Dr. Pichet Kunadhamraks",
    "Anan Pho Nimdaeng",
    "Pattanaphong Phongsupatsamit",
    "Pattanaphong Phongnsupatsamit",
  ],
};

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

function rewriteChanchaoColumn(
  $: cheerio.CheerioAPI,
  element: AnyNode,
  language: WpContentRecord["language"],
): boolean {
  if (language !== "en") {
    return false;
  }

  const column = $(element);
  if (compactText(column.find("h4").first().text()) !== "ชาญเชาวน์ ไชยานุกิจ") {
    return false;
  }

  column.find("h4").first().text("Chanchao Chaiyanukij");
  column.find("h5").first().empty().append("Expert Committee Member");
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

function removeNamedBoardColumn($: cheerio.CheerioAPI, element: AnyNode): boolean {
  const column = $(element);
  if (!REMOVED_BOARD_NAMES.has(compactText(column.find("h4").first().text()))) {
    return false;
  }

  column.remove();
  return true;
}

function rewriteRailwayRepresentativeColumn(
  $: cheerio.CheerioAPI,
  element: AnyNode,
  language: WpContentRecord["language"],
): boolean {
  const column = $(element);
  const heading = compactText(column.find("h4").first().text());
  if (
    !REPRESENTATIVE_RAILWAY_NAMES.has(heading) ||
    (language === "th" && heading === "ดร. วีรเดช ชีวาพัฒนานุวงศ์")
  ) {
    return false;
  }

  column
    .find("h4")
    .first()
    .text(
      language === "en" ? "Dr. Weeradet Cheevapattananuwong" : "นายอนันต์ โพธิ์นิ่มแดง",
    );
  const image = column.find("img").first();
  image.attr("src", language === "en" ? WEERADET_IMAGE_SRC : ANAN_IMAGE_SRC);
  image.attr(
    "alt",
    language === "en" ? "Dr. Weeradet Cheevapattananuwong" : "นายอนันต์ โพธิ์นิ่มแดง",
  );
  image.removeAttr("srcset");
  image.removeAttr("sizes");
  const role = column.find("h5").first();
  role.empty();
  role.append(language === "en" ? "Expert Committee Member" : "กรรมการ");
  return true;
}

function addWeeradetColumn($: cheerio.CheerioAPI, element: AnyNode): boolean {
  const existing = $(".lightweight-accordion .wp-block-column h4").filter(
    (_, heading) => compactText($(heading).text()) === "ดร. วีรเดช ชีวาพัฒนานุวงศ์",
  );
  if (existing.length > 0) {
    return false;
  }

  const column = $(element);
  if (compactText(column.find("h4").first().text()) !== "นายอนันต์ โพธิ์นิ่มแดง") {
    return false;
  }
  const clone = column.clone();
  clone.find("h4").first().text("ดร. วีรเดช ชีวาพัฒนานุวงศ์");
  clone.find("h5").first().empty().append("กรรมการผู้ทรงคุณวุฒิ");
  const image = clone.find("img").first();
  image.attr("src", WEERADET_IMAGE_SRC);
  image.attr("alt", "ดร. วีรเดช ชีวาพัฒนานุวงศ์");
  image.removeAttr("srcset");
  image.removeAttr("sizes");
  column.after(clone);
  return true;
}

function reorderBoardColumns(
  $: cheerio.CheerioAPI,
  language: WpContentRecord["language"],
): boolean {
  const boardAccordions = $(".lightweight-accordion").filter((_, element) => {
    const title = compactText($(element).find("summary").first().text());
    return title.includes("คณะกรรมการ") || title.includes("Board");
  });
  const accordion =
    boardAccordions.length > 0
      ? boardAccordions.first()
      : $(".lightweight-accordion").first();
  const allColumns = accordion
    .find(".lightweight-accordion-body .wp-block-column")
    .toArray();
  if (allColumns.length === 0) {
    allColumns.push(...accordion.find(".wp-block-column").toArray());
  }
  const firstRow = accordion
    .find(".lightweight-accordion-body > .wp-block-columns")
    .first();
  const firstRowColumns = firstRow.children(".wp-block-column").toArray();
  const columns =
    firstRowColumns.length > 0
      ? allColumns.filter((element) => !firstRowColumns.includes(element))
      : allColumns;
  const names = columns.map((element) =>
    compactText($(element).find("h4").first().text()),
  );
  const desiredNames = BOARD_CARD_ORDER[language].filter((name) => names.includes(name));
  const orderedNames = [
    ...desiredNames,
    ...names.filter((name) => !desiredNames.includes(name)),
  ];
  if (orderedNames.every((name, index) => name === names[index])) {
    return false;
  }

  const htmlByName = new Map(
    columns.map((element) => [
      compactText($(element).find("h4").first().text()),
      $(element).toString(),
    ]),
  );
  columns.forEach((element, index) => {
    $(element).replaceWith(htmlByName.get(orderedNames[index]) ?? "");
  });
  return true;
}

function rewriteMinistryRepresentativeColumn(
  $: cheerio.CheerioAPI,
  element: AnyNode,
  language: WpContentRecord["language"],
): boolean {
  const column = $(element);
  const heading = compactText(column.find("h4").first().text());
  if (language === "en" && heading === REPRESENTATIVE_MINISTRY_NAME) {
    column.find("h4").first().text(REPRESENTATIVE_MINISTRY_NAME_EN);
    column.find("h5").first().empty().append("Ex Officio Board Member");
    return true;
  }
  if (language !== "th" || heading !== REPRESENTATIVE_MINISTRY_NAME) {
    return false;
  }

  const image = column.find("img").first();
  image.attr("src", WATCHARACHAN_IMAGE_SRC);
  image.attr("alt", "วัชรชาญ สิริสุวรรณทัศน์");
  image.removeAttr("srcset");
  image.removeAttr("sizes");
  column.find("h4").first().text("วัชรชาญ สิริสุวรรณทัศน์");
  column.find("h5").first().empty().append("กรรมการผู้ทรงคุณวุฒิ");
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

function rewriteEnglishManagerColumn($: cheerio.CheerioAPI, element: AnyNode): boolean {
  const column = $(element);
  const role = compactText(column.find("h5").first().text());
  const roleTranslations: Array<[string, string]> = [
    ["ผู้จัดการกลุ่มวิจัยและมาตรฐาน", "Research and Standards Group Manager"],
    [
      "ผู้จัดการกลุ่มพัฒนาผู้ประกอบการและธุรกิจใหม่",
      "New Entrepreneurs and Business Development Group Manager",
    ],
    [
      "ผู้จัดการกลุ่มพัฒนาดิจิทัลระบบราง",
      "Rail Systems Digital Development Group Manager",
    ],
    [
      "ผู้จัดการกลุ่มกลยุทธ์และสื่อสารองค์กร",
      "Strategy and Corporate Communications Group Manager",
    ],
    ["ผู้จัดการกลุ่มบริหารภายใน", "Internal Administration Group Manager"],
  ];
  const translation = roleTranslations.find(([thaiRole]) => role.includes(thaiRole));
  const heading = compactText(column.find("h4").first().text());
  const nameTranslations = new Map([
    [OLD_NAME, "Touchakorn Thanawatdamrong"],
    ["ดร.กิติพันธุ์ นุตยกุล", "Touchakorn Thanawatdamrong"],
    [CHAIYUT_NAME, "Chaiyut Tanchai"],
  ]);
  const translatedName = nameTranslations.get(heading);
  if (!translation && !translatedName) {
    return false;
  }

  if (translation) {
    column.find("h5").first().empty().append(translation[1]);
  }
  if (translatedName) {
    column.find("h4").first().text(translatedName);
    column.find("img").first().attr("alt", translatedName);
  }
  return true;
}

export function applyBoardExecutiveOverride(record: WpContentRecord): WpContentRecord {
  if (!isBoardExecutivePath(record)) {
    return record;
  }

  const $ = cheerio.load(record.contentHtml, null, false);
  const columns = $(".lightweight-accordion .wp-block-column").toArray();
  let didRemoveNamedBoardCards = false;
  for (const element of columns) {
    didRemoveNamedBoardCards =
      removeNamedBoardColumn($, element) || didRemoveNamedBoardCards;
  }
  const didRewritePichet = columns.some((element) =>
    rewritePichetColumn($, element, record.language),
  );
  const didRewritePattanaphong = columns.some((element) =>
    rewritePattanaphongColumn($, element, record.language),
  );
  const didRewriteChanchao = columns.some((element) =>
    rewriteChanchaoColumn($, element, record.language),
  );
  const didRewritePiangOr = columns.some((element) =>
    rewritePiangOrColumn($, element, record.language),
  );
  const didRemoveThavorn = columns.some((element) => removeThavornColumn($, element));
  const didRewriteRailwayRepresentative = columns.some((element) =>
    rewriteRailwayRepresentativeColumn($, element, record.language),
  );
  const didAddWeeradet =
    record.language === "th" && columns.some((element) => addWeeradetColumn($, element));
  const didRewriteMinistryRepresentative = columns.some((element) =>
    rewriteMinistryRepresentativeColumn($, element, record.language),
  );
  const didRewriteResearch =
    record.language === "th" &&
    columns.some((element) => rewriteTargetColumn($, element));
  const didRewriteAdmin =
    record.language === "th" && columns.some((element) => rewriteAdminColumn($, element));
  let didRewriteEnglishManagers = false;
  if (record.language === "en") {
    for (const element of columns) {
      didRewriteEnglishManagers =
        rewriteEnglishManagerColumn($, element) || didRewriteEnglishManagers;
    }
  }
  const didReorderColumns = reorderBoardColumns($, record.language);

  if (
    !didRewritePichet &&
    !didRewritePattanaphong &&
    !didRewriteChanchao &&
    !didRewritePiangOr &&
    !didRemoveThavorn &&
    !didRemoveNamedBoardCards &&
    !didRewriteRailwayRepresentative &&
    !didAddWeeradet &&
    !didRewriteMinistryRepresentative &&
    !didRewriteResearch &&
    !didRewriteAdmin &&
    !didRewriteEnglishManagers &&
    !didReorderColumns
  ) {
    return record;
  }

  return {
    ...record,
    contentHtml: $.html(),
  };
}
