import * as cheerio from "cheerio";
import type { WpContentRecord } from "./types";
import { normalizeRoutePath } from "./url";

export const PUBLIC_HEARING_PATH = "/ประชาพิจารณ์";
export const PUBLIC_HEARING_DOCUMENT_HREF =
  "/public-hearing-documents/ss-1001-2569-evacuation-20261001.pdf";
export const PUBLIC_HEARING_COVER_IMAGE =
  "/public-hearing-documents/ss-1001-2569-cover.webp";

const YEAR = "2569";
const DOCUMENT_CODE = "สทร.-SS-1001:2569";
const DOCUMENT_TITLE =
  "มาตรฐานว่าด้วยการอพยพผู้ใช้บริการขนส่งทางราง กรณีเกิดเหตุอัคคีภัยหรือกรณีฉุกเฉิน";

export function isPublicHearingPath(path: string): boolean {
  return normalizeRoutePath(path).normalize("NFC") === PUBLIC_HEARING_PATH;
}

export function applyPublicHearingDocumentsOverride(
  record: WpContentRecord,
): WpContentRecord {
  if (!isPublicHearingPath(record.path)) {
    return record;
  }

  const $ = cheerio.load(record.contentHtml, null, false);
  const accordion = $(".lightweight-accordion")
    .filter((_, element) => $(element).find("summary").first().text().includes(YEAR))
    .first();
  const column = accordion
    .find(".lightweight-accordion-body .wp-block-columns")
    .first()
    .children(".wp-block-column")
    .first();

  if (column.length === 0) {
    return record;
  }

  const cover = $("<figure></figure>").append(
    $("<img />")
      .attr("src", PUBLIC_HEARING_COVER_IMAGE)
      .attr("alt", `หน้าปก ${DOCUMENT_CODE} ${DOCUMENT_TITLE}`),
  );
  const existingCard =
    column.find(`a[href="${PUBLIC_HEARING_DOCUMENT_HREF}"]`).length > 0;
  const hasCover = column.find(`img[src="${PUBLIC_HEARING_COVER_IMAGE}"]`).length > 0;

  if (existingCard) {
    if (hasCover) return record;
    column.prepend(cover);
    return { ...record, contentHtml: $.html() };
  }

  column.empty();
  column.append(cover);
  column.append($(`<h6></h6>`).text(`(ร่าง) ${DOCUMENT_CODE}`));
  column.append($(`<p></p>`).text(`(ร่าง) ${DOCUMENT_TITLE}`));
  column.append(
    $('<div class="wp-block-button detail-btn"></div>').append(
      $("<a></a>").attr("href", PUBLIC_HEARING_DOCUMENT_HREF).text("อ่านเพิ่มเติม"),
    ),
  );
  column.append(
    $("<p></p>").append(
      $("<a></a>").attr("href", PUBLIC_HEARING_DOCUMENT_HREF).text("ดาวน์โหลดไฟล์"),
    ),
  );

  return { ...record, contentHtml: $.html() };
}
