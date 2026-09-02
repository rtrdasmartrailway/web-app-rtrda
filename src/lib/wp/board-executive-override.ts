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
const REPRESENTATIVE_MINISTRY_NAME =
  "ผู้แทน กระทรวงการอุดมศึกษา วิทยาศาสตร์ วิจัยและนวัตกรรม";
const REPRESENTATIVE_MINISTRY_NAME_EN =
  "Representative of the Ministry of Higher Education, Science, Research and Innovation";
const REPRESENTATIVE_RAILWAY_NAMES = new Set([
  "ผู้แทน ผู้ว่าการรถไฟแห่งประเทศไทย",
  "ดร. วีรเดช ชีวาพัฒนานุวงศ์",
  "Dr. Weeradet Cheevapattananuwong",
]);
export const ANAN_IMAGE_SRC =
  "/wp-content/uploads/2026/08/anan-pho-nimdaeng.png?v=20260901";
const REMOVED_BOARD_NAMES = new Set([
  "ดร. จุลเทพ ขจรไชยกูล",
  "ดร.จุลเทพ ขจรไชยกูล",
  "วัชรชาญ สิริสุวรรณทัศน์",
  "Watcharachan Sirisuwannatash",
]);
export const WATCHARACHAN_IMAGE_SRC =
  "/wp-content/uploads/2026/08/watcharachan-sirisuwannatat.png?v=20260829";
export const WEERADET_IMAGE_SRC =
  "/wp-content/uploads/2026/08/weeradet-cheevapattananuwong.jpg";
export const VEERACHAI_IMAGE_SRC = "/wp-content/uploads/2026/08/veerachai-archan.jpg";
const VEERACHAI_NAME = "ผศ.ดร.วีรชัย อาจหาญ";
const VEERACHAI_ROLE = "ผู้ว่าการ สถาบันวิจัยวิทยาศาสตร์และเทคโนโลยีแห่งประเทศไทย";
const BOARD_CARD_ORDER = new Map([
  ["รศ.ดร. โชติชัย เจริญงาม", 1],
  ["Assoc. Prof. Dr. Chotchai Charoenngam", 1],
  ["ถาวร ชลัษเฐียร", 2],
  ["Thavorn Chalassathien", 2],
  ["ดรุณ แสงฉาย", 3],
  ["Darun Saengshine", 3],
  ["ชาญเชาวน์ ไชยานุกิจ", 4],
  ["Chanchao Chaiyanukij", 4],
  ["ผศ. พิศิษฐ์ แสง-ชูโต", 5],
  ["Asst. Prof. Pisit Saeng-Xuto", 5],
  ["ดร. วีรเดช ชีวาพัฒนานุวงศ์", 6],
  ["Dr. Weeradet Cheevapattananuwong", 6],
  ["วัชรชาญ สิริสุวรรณทัศน์", 7],
  ["Watcharachan Sirisuwannatash", 7],
  ["ดร. พิเชฐ คุณาธรรมรักษ์", 8],
  ["Dr. Pichet Kunadhamraks", 8],
  ["นายอนันต์ โพธิ์นิ่มแดง", 9],
  ["Anan Pho Nimdaeng", 9],
  ["พัฒนพงษ์ พงศ์ศุภสมิทธิ์", 10],
  ["Pattanaphong Phongsupatsamit", 10],
  ["Pattanaphong Phongnsupatsamit", 10],
  [VEERACHAI_NAME, 11],
  ["Asst. Prof. Dr. Veerachai Archan", 11],
  ["ดร. เพียงออ เลาหะวิไลย", 12],
  ["Dr. Piang-or Loahavilai", 12],
]);

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

function rewriteEnglishBoardColumn($: cheerio.CheerioAPI, element: AnyNode): boolean {
  const column = $(element);
  const heading = compactText(column.find("h4").first().text());
  const role = compactText(column.find("h5").first().text());
  const nameTranslations = new Map([
    ["ชาญเชาวน์ ไชยานุกิจ", "Chanchao Chaiyanukij"],
    ["ถาวร ชลัษเฐียร", "Thavorn Chalassathien"],
    ["นายอนันต์ โพธิ์นิ่มแดง", "Anan Pho Nimdaeng"],
    ["ดร. วีรเดช ชีวาพัฒนานุวงศ์", "Dr. Weeradet Cheevapattananuwong"],
    [VEERACHAI_NAME, "Asst. Prof. Dr. Veerachai Archan"],
    ["วัชรชาญ สิริสุวรรณทัศน์", "Watcharachan Sirisuwannatash"],
    [
      "ผู้แทน ผู้ว่าการรถไฟแห่งประเทศไทย",
      "Representative of the Governor of State Railway of Thailand",
    ],
    ["ดร. จุลเทพ ขจรไชยกูล", "Dr. Chulatep Khajornchaiyagul"],
    [OLD_NAME, "Touchakorn Thanawatdamrong"],
    ["ดร.กิติพันธุ์ นุตยกุล", "Touchakorn Thanawatdamrong"],
    [CHAIYUT_NAME, "Chaiyut Tanchai"],
  ]);
  const roleTranslations = new Map([
    ["กรรมการผู้ทรงคุณวุฒิ", "Expert Committee Member"],
    ["ที่ปรึกษาคณะกรรมการ", "Board Advisor"],
    ["กรรมการ", "Board Member"],
    [
      VEERACHAI_ROLE,
      "Governor, Thailand Institute of Scientific and Technological Research",
    ],
    ["กรรมการโดยตำแหน่ง ผู้ว่าการรถไฟแห่งประเทศไทย", "Ex Officio Board Member"],
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
  ]);
  const translatedName = nameTranslations.get(heading);
  const translatedRole = [...roleTranslations].find(([thaiRole]) =>
    role.includes(thaiRole),
  )?.[1];
  if (!translatedName && !translatedRole) {
    return false;
  }

  if (translatedName) {
    column.find("h4").first().text(translatedName);
    column.find("img").first().attr("alt", translatedName);
  }
  if (translatedRole) {
    column.find("h5").first().empty().append(translatedRole);
  }
  return true;
}

function rewriteEnglishMinistryColumn($: cheerio.CheerioAPI, element: AnyNode): boolean {
  const column = $(element);
  if (compactText(column.find("h4").first().text()) !== REPRESENTATIVE_MINISTRY_NAME) {
    return false;
  }
  column.find("h4").first().text(REPRESENTATIVE_MINISTRY_NAME_EN);
  column.find("h5").first().empty().append("Ex Officio Board Member");
  return true;
}

function rewriteEnglishExecutiveColumn($: cheerio.CheerioAPI, element: AnyNode): boolean {
  const column = $(element);
  const role = compactText(column.find("h5").first().text());
  const heading = column.find("h4").first();
  const image = column.find("img").first();

  if (role.includes(TARGET_ROLE)) {
    heading.text("Touchakorn Thanawatdamrong");
    image.attr("src", TACHAKORN_IMAGE_SRC).attr("alt", "Touchakorn Thanawatdamrong");
    column
      .find("h5")
      .first()
      .empty()
      .append(
        'Research and Standards Group Manager<br>Email: <a href="mailto:touchakorn.t@rtrda.or.th">touchakorn.t@rtrda.or.th</a>',
      );
    return true;
  }

  if (role.includes("ผู้จัดการกลุ่มพัฒนาผู้ประกอบการและธุรกิจใหม่")) {
    heading.text("Chaiyut Tanchai");
    image.attr("src", CHAIYUT_IMAGE_SRC).attr("alt", "Chaiyut Tanchai");
    column
      .find("h5")
      .first()
      .empty()
      .append(
        'New Entrepreneurs and Business Development Group Manager<br>Email: <a href="mailto:chaiwooth.t@rtrda.or.th">chaiwooth.t@rtrda.or.th</a>',
      );
    return true;
  }

  if (role.includes(ADMIN_ROLE)) {
    heading.text("Chaiyut Tanchai");
    image.attr("src", CHAIYUT_IMAGE_SRC).attr("alt", "Chaiyut Tanchai");
    image.removeAttr("srcset");
    image.removeAttr("sizes");
    column
      .find("h5")
      .first()
      .empty()
      .append(
        'Internal Administration Group Manager (Acting)<br>Email: <a href="mailto:chaiwooth.t@rtrda.or.th">chaiwooth.t@rtrda.or.th</a>',
      );
    return true;
  }

  return false;
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
    .text(language === "en" ? "Anan Pho Nimdaeng" : "นายอนันต์ โพธิ์นิ่มแดง");
  const image = column.find("img").first();
  image.attr("src", ANAN_IMAGE_SRC);
  image.attr("alt", language === "en" ? "Anan Pho Nimdaeng" : "นายอนันต์ โพธิ์นิ่มแดง");
  image.removeAttr("srcset");
  image.removeAttr("sizes");
  const role = column.find("h5").first();
  role.empty();
  role.append(language === "en" ? "Board Member" : "กรรมการ");
  return true;
}

function rewriteAnanColumn($: cheerio.CheerioAPI, element: AnyNode): boolean {
  const column = $(element);
  if (
    !new Set(["นายอนันต์ โพธิ์นิ่มแดง", "Anan Pho Nimdaeng"]).has(
      compactText(column.find("h4").first().text()),
    )
  ) {
    return false;
  }

  const image = column.find("img").first();
  image.attr("src", ANAN_IMAGE_SRC);
  image.removeAttr("srcset");
  image.removeAttr("sizes");
  return true;
}

function reorderBoardColumns($: cheerio.CheerioAPI): boolean {
  const board = $(".lightweight-accordion")
    .filter((_, element) =>
      /คณะกรรมการสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง|Board of Directors/.test(
        $(element).find(".lightweight-accordion-title").first().text(),
      ),
    )
    .first();
  const cards = board
    .find(".wp-block-column")
    .filter((_, element) =>
      BOARD_CARD_ORDER.has(compactText($(element).find("h4").first().text())),
    )
    .toArray();
  const orderedCards = [...cards].sort(
    (left, right) =>
      BOARD_CARD_ORDER.get(compactText($(left).find("h4").first().text()))! -
      BOARD_CARD_ORDER.get(compactText($(right).find("h4").first().text()))!,
  );

  if (cards.length !== 12 || cards.every((card, index) => card === orderedCards[index])) {
    return false;
  }

  const destinations = cards.map((card) => $(card).parent());
  orderedCards.forEach((card, index) => destinations[index].append(card));
  return true;
}

function addWeeradetColumn(
  $: cheerio.CheerioAPI,
  element: AnyNode,
  language: WpContentRecord["language"],
): boolean {
  const existing = $(".lightweight-accordion .wp-block-column h4").filter((_, heading) =>
    new Set(["ดร. วีรเดช ชีวาพัฒนานุวงศ์", "Dr. Weeradet Cheevapattananuwong"]).has(
      compactText($(heading).text()),
    ),
  );
  if (existing.length > 0) {
    return false;
  }

  const column = $(element);
  if (
    !new Set(["นายอนันต์ โพธิ์นิ่มแดง", "Anan Pho Nimdaeng"]).has(
      compactText(column.find("h4").first().text()),
    )
  ) {
    return false;
  }
  const clone = column.clone();
  clone
    .find("h4")
    .first()
    .text(
      language === "en"
        ? "Dr. Weeradet Cheevapattananuwong"
        : "ดร. วีรเดช ชีวาพัฒนานุวงศ์",
    );
  clone
    .find("h5")
    .first()
    .empty()
    .append(language === "en" ? "Expert Committee Member" : "กรรมการผู้ทรงคุณวุฒิ");
  const image = clone.find("img").first();
  image.attr("src", WEERADET_IMAGE_SRC);
  image.attr(
    "alt",
    language === "en" ? "Dr. Weeradet Cheevapattananuwong" : "ดร. วีรเดช ชีวาพัฒนานุวงศ์",
  );
  image.removeAttr("srcset");
  image.removeAttr("sizes");
  column.after(clone);
  return true;
}

function addVeerachaiColumn(
  $: cheerio.CheerioAPI,
  elements: AnyNode[],
  language: WpContentRecord["language"],
): boolean {
  const existing = $(".lightweight-accordion .wp-block-column h4").filter((_, heading) =>
    new Set([VEERACHAI_NAME, "Asst. Prof. Dr. Veerachai Archan"]).has(
      compactText($(heading).text()),
    ),
  );
  if (existing.length > 0 || elements.length === 0) {
    return false;
  }

  const source = elements.find((element) =>
    new Set([
      "นายอนันต์ โพธิ์นิ่มแดง",
      "Anan Pho Nimdaeng",
      "ดร. วีรเดช ชีวาพัฒนานุวงศ์",
      "Dr. Weeradet Cheevapattananuwong",
    ]).has(compactText($(element).find("h4").first().text())),
  );
  if (!source) {
    return false;
  }
  const column = $(source);
  const clone = column.clone();
  clone
    .find("h4")
    .first()
    .text(language === "en" ? "Asst. Prof. Dr. Veerachai Archan" : VEERACHAI_NAME);
  clone
    .find("h5")
    .first()
    .empty()
    .append(
      language === "en"
        ? "Governor, Thailand Institute of Scientific and Technological Research"
        : VEERACHAI_ROLE,
    );
  const image = clone.find("img").first();
  image.attr("src", VEERACHAI_IMAGE_SRC);
  image.attr(
    "alt",
    language === "en" ? "Asst. Prof. Dr. Veerachai Archan" : VEERACHAI_NAME,
  );
  image.removeAttr("srcset");
  image.removeAttr("sizes");
  const detailButton = clone.find(".detail-btn");
  detailButton.addClass("detail-btn-disabled").attr("aria-disabled", "true");
  detailButton.find("a").removeAttr("href").attr({
    "aria-disabled": "true",
    tabindex: "-1",
  });
  const weeradetColumn = $(".lightweight-accordion .wp-block-column").filter(
    (_, element) =>
      new Set(["ดร. วีรเดช ชีวาพัฒนานุวงศ์", "Dr. Weeradet Cheevapattananuwong"]).has(
        compactText($(element).find("h4").first().text()),
      ),
  );
  (weeradetColumn.length > 0 ? weeradetColumn.first() : column).after(clone);
  return true;
}

function rewriteMinistryRepresentativeColumn(
  $: cheerio.CheerioAPI,
  element: AnyNode,
  language: WpContentRecord["language"],
): boolean {
  const column = $(element);
  if (compactText(column.find("h4").first().text()) !== REPRESENTATIVE_MINISTRY_NAME) {
    return false;
  }

  const image = column.find("img").first();
  image.attr("src", WATCHARACHAN_IMAGE_SRC);
  image.attr(
    "alt",
    language === "en" ? "Watcharachan Sirisuwannatash" : "วัชรชาญ สิริสุวรรณทัศน์",
  );
  image.removeAttr("srcset");
  image.removeAttr("sizes");
  column
    .find("h4")
    .first()
    .text(language === "en" ? "Watcharachan Sirisuwannatash" : "วัชรชาญ สิริสุวรรณทัศน์");
  column
    .find("h5")
    .first()
    .empty()
    .append(language === "en" ? "Expert Committee Member" : "กรรมการผู้ทรงคุณวุฒิ");
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
  const didRewritePiangOr = columns.some((element) =>
    rewritePiangOrColumn($, element, record.language),
  );
  const didRewriteRailwayRepresentative = columns.some((element) =>
    rewriteRailwayRepresentativeColumn($, element, record.language),
  );
  const didRewriteAnan = columns.some((element) => rewriteAnanColumn($, element));
  const didAddWeeradet = columns.some((element) =>
    addWeeradetColumn($, element, record.language),
  );
  const didAddVeerachai = addVeerachaiColumn($, columns, record.language);
  const didRewriteMinistryRepresentative = columns.some((element) =>
    rewriteMinistryRepresentativeColumn($, element, record.language),
  );
  const didRewriteResearch =
    record.language === "th" &&
    columns.some((element) => rewriteTargetColumn($, element));
  const didRewriteAdmin =
    record.language === "th" && columns.some((element) => rewriteAdminColumn($, element));
  let didRewriteEnglish = false;
  if (record.language === "en") {
    for (const element of columns) {
      didRewriteEnglish = rewriteEnglishExecutiveColumn($, element) || didRewriteEnglish;
      didRewriteEnglish = rewriteEnglishBoardColumn($, element) || didRewriteEnglish;
      didRewriteEnglish = rewriteEnglishMinistryColumn($, element) || didRewriteEnglish;
    }
  }
  const didReorderBoard = reorderBoardColumns($);

  if (
    !didRewritePichet &&
    !didRewritePattanaphong &&
    !didRewritePiangOr &&
    !didRemoveNamedBoardCards &&
    !didRewriteRailwayRepresentative &&
    !didRewriteAnan &&
    !didAddWeeradet &&
    !didAddVeerachai &&
    !didRewriteMinistryRepresentative &&
    !didRewriteResearch &&
    !didRewriteAdmin &&
    !didRewriteEnglish &&
    !didReorderBoard
  ) {
    return record;
  }

  return {
    ...record,
    contentHtml: $.html(),
  };
}
