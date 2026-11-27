import * as cheerio from "cheerio";
import type { WpContentRecord } from "./types";
import { normalizeRoutePath } from "./url";

export const PUBLIC_HEARING_PATH = "/ประชาพิจารณ์";

const YEAR = "2569";
export const PUBLIC_HEARING_DOCUMENTS = [
  {
    code: "สทร. RS-6005:2569",
    title: "มาตรฐานการทดสอบระบบปรับอากาศของรถไฟโดยสารทางไกล",
    href: "/public-hearing-documents/rs-6005-2569-air-conditioning.pdf",
    coverImage: "/public-hearing-documents/rs-6005-2569-air-conditioning.png",
  },
  {
    code: "สทร. RS-6006:2569",
    title: "มาตรฐานการทดสอบเบาะและเก้าอี้ผู้โดยสารสำหรับรถไฟโดยสาร",
    href: "/public-hearing-documents/rs-6006-2569-seats.pdf",
    coverImage: "/public-hearing-documents/rs-6006-2569-seats.png",
  },
  {
    code: "สทร. RS-6008:2569",
    title: "มาตรฐานการทดสอบจอแสดงข้อมูลสำหรับผู้โดยสารบนตัวรถไฟ",
    href: "/public-hearing-documents/rs-6008-2569-display.pdf",
    coverImage: "/public-hearing-documents/rs-6008-2569-display.png",
  },
] as const;

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
  const columns = accordion.find(".lightweight-accordion-body .wp-block-columns").first();
  const column = columns.children(".wp-block-column").first();

  if (column.length === 0) {
    return record;
  }

  const hasAllCards = PUBLIC_HEARING_DOCUMENTS.every(
    ({ href, coverImage }) =>
      columns.find(`a[href="${href}"]`).length > 0 &&
      columns.find(`img[src="${coverImage}"]`).length > 0,
  );
  if (hasAllCards) return record;

  columns.empty();
  for (const { code, title, href, coverImage } of PUBLIC_HEARING_DOCUMENTS) {
    const card = $('<div class="wp-block-column"></div>');
    card.append(
      $("<figure></figure>").append(
        $("<img />")
          .attr("src", coverImage)
          .attr("alt", `หน้าปก (ร่าง) ${code} (ร่าง) ${title}`),
      ),
    );
    card.append($(`<h6></h6>`).text(`(ร่าง) ${code}`));
    card.append($(`<p></p>`).text(`(ร่าง) ${title}`));
    card.append(
      $('<div class="wp-block-button detail-btn"></div>').append(
        $("<a></a>").attr("href", href).text("อ่านเพิ่มเติม"),
      ),
    );
    card.append(
      $("<p></p>").append($("<a></a>").attr("href", href).text("ดาวน์โหลดไฟล์")),
    );
    columns.append(card);
  }

  return { ...record, contentHtml: $.html() };
}
