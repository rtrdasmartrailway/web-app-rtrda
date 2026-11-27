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
  },
  {
    code: "สทร. RS-6006:2569",
    title: "มาตรฐานการทดสอบเบาะและเก้าอี้ผู้โดยสารสำหรับรถไฟโดยสาร",
    href: "/public-hearing-documents/rs-6006-2569-seats.pdf",
  },
  {
    code: "สทร. RS-6008:2569",
    title: "มาตรฐานการทดสอบจอแสดงข้อมูลสำหรับผู้โดยสารบนตัวรถไฟ",
    href: "/public-hearing-documents/rs-6008-2569-display.pdf",
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
  const body = accordion.find(".lightweight-accordion-body").first();
  const columns = body.find(".wp-block-columns").first();

  if (body.length === 0 || columns.length === 0) {
    return record;
  }

  const table = body.find("table").first();
  const hasAllRows = PUBLIC_HEARING_DOCUMENTS.every(
    ({ href }) => table.find(`a[href="${href}"]`).length > 0,
  );
  if (hasAllRows) return record;

  const tableFigure = $(
    '<figure class="wp-block-table is-style-vk-table-border-stripes"></figure>',
  );
  const replacementTable = $("<table></table>");
  replacementTable.append(
    $("<thead></thead>").append(
      $("<tr></tr>")
        .append($('<th scope="col"></th>').text("ลำดับ"))
        .append($('<th scope="col"></th>').text("รายการร่างมาตรฐาน"))
        .append($('<th scope="col"></th>').text("เอกสาร")),
    ),
  );

  const rows = $("<tbody></tbody>");
  PUBLIC_HEARING_DOCUMENTS.forEach(({ code, title, href }, index) => {
    const row = $("<tr></tr>");
    row.append($("<td></td>").text(String(index + 1)));
    row.append(
      $("<td></td>")
        .append($("<p></p>").text(`(ร่าง) ${code}`))
        .append($("<p></p>").text(`(ร่าง) ${title}`)),
    );
    row.append(
      $("<td></td>")
        .append(
          $("<p></p>").append($("<a></a>").attr("href", href).text("อ่านเพิ่มเติม")),
        )
        .append(
          $("<p></p>").append(
            $("<a></a>")
              .attr("href", href)
              .attr("download", href.split("/").pop() ?? "document.pdf")
              .text("ดาวน์โหลดไฟล์"),
          ),
        ),
    );
    rows.append(row);
  });

  replacementTable.append(rows);
  tableFigure.append(replacementTable);
  columns.replaceWith(tableFigure);

  // Remove any legacy SS-1001 table in the same year accordion.
  body.find("table").not(replacementTable).remove();

  return { ...record, contentHtml: $.html() };
}
