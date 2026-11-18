import * as cheerio from "cheerio";
import type { Cheerio } from "cheerio";
import type { AnyNode } from "domhandler";
import type { WpContentRecord } from "./types";
import { normalizeRoutePath } from "./url";

const JOB_APPLICATION_PATH = "/ข่าวสาร-กิจกรรม/ร่วมงานกับ-สทร/สมัครงาน";
const PREVIOUS_NOTICE_DATE = "28 กันยายน 2569";
const TARGET_POSITION = "เจ้าหน้าที่สนับสนุนงานนโยบายและแผน";
const NOTICE_DOCUMENT_URL = "/job-application-policy-planning-support-25691001.pdf";

function isJobApplicationPath(path: string): boolean {
  return normalizeRoutePath(path).replace(/^\/en(?=\/)/, "") === JOB_APPLICATION_PATH;
}

function applyPreviousJobApplicationNoticeOverride(
  record: WpContentRecord,
): WpContentRecord {
  if (!isJobApplicationPath(record.path)) return record;

  const $ = cheerio.load(record.contentHtml, null, false);
  const noticeRow = $("tbody tr")
    .filter((_, row) => {
      const cells = $(row).find("td");
      return (
        cells.eq(1).text().replace(/\s+/g, " ").trim() === PREVIOUS_NOTICE_DATE &&
        $(row).text().includes(TARGET_POSITION)
      );
    })
    .first();
  if (noticeRow.length === 0) return record;

  const cells = noticeRow.find("td");
  if (cells.length < 6) return record;

  let changed = false;
  const setCellText = (index: number, text: string) => {
    const cell = cells.eq(index);
    if (cell.text().replace(/\s+/g, " ").trim() !== text) {
      cell.text(text);
      changed = true;
    }
  };

  setCellText(1, "1 ตุลาคม 2569");
  setCellText(
    2,
    "ประกาศเปิดรับสมัครงาน ตำแหน่ง เจ้าหน้าที่สนับสนุนงานนโยบายและแผน (จ้างเหมาบริการ)",
  );
  setCellText(3, "1 อัตรา");

  setCellText(4, "–");

  const documentCell = cells.eq(5);
  let documentLink: Cheerio<AnyNode> = documentCell.find("a").first();
  if (documentLink.length === 0) {
    documentCell.empty();
    documentLink = $("<a></a>").text("PDF");
    documentCell.append(documentLink);
    changed = true;
  }
  if (documentLink.attr("href") !== NOTICE_DOCUMENT_URL) {
    documentLink.attr("href", NOTICE_DOCUMENT_URL);
    changed = true;
  }
  if (documentLink.text().trim() !== "PDF") {
    documentLink.text("PDF");
    changed = true;
  }
  if (documentLink.attr("target") !== "_blank") {
    documentLink.attr("target", "_blank");
    changed = true;
  }
  if (documentLink.attr("rel") !== "noreferrer noopener") {
    documentLink.attr("rel", "noreferrer noopener");
    changed = true;
  }

  return changed ? { ...record, contentHtml: $.html() } : record;
}

export function applyJobApplicationNoticeOverride(
  record: WpContentRecord,
): WpContentRecord {
  const previous = applyPreviousJobApplicationNoticeOverride(record);
  if (!isJobApplicationPath(previous.path)) return previous;

  const $ = cheerio.load(previous.contentHtml, null, false);
  const title =
    "ประกาศสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) เรื่อง ประกาศรายชื่อผู้มีสิทธิ์เข้ารับการสอบคัดเลือกเป็นเจ้าหน้าที่ของสถาบันฯ ตำแหน่ง นักวิเคราะห์วิชาการ / อาวุโส (วิศวกร)";
  const tbody = $("tbody")
    .filter((_, element) => $(element).find("tr td").length >= 6)
    .first();
  if (
    !tbody.length ||
    tbody
      .find("tr")
      .toArray()
      .some((row) => $(row).text().includes(title))
  ) {
    return previous;
  }

  const row = $("<tr></tr>");
  ["", "18 พฤศจิกายน 2569", title, "–", "–"].forEach((text) =>
    row.append(
      $("<td></td>")
        .addClass("has-text-align-center")
        .attr("data-align", "center")
        .text(text),
    ),
  );
  row.append(
    $("<td></td>")
      .addClass("has-text-align-center")
      .attr("data-align", "center")
      .append(
        $("<a></a>")
          .attr(
            "href",
            "/recruitment-documents/eligible-candidates-engineer-25691118.pdf",
          )
          .attr("target", "_blank")
          .attr("rel", "noreferrer noopener")
          .text("PDF 1"),
      ),
  );
  tbody.prepend(row);
  tbody.find("tr").each((index, element) => {
    $(element).find("td").first().text(String(index + 1));
  });
  return { ...previous, contentHtml: $.html() };
}
