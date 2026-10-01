import * as cheerio from "cheerio";
import type { Cheerio } from "cheerio";
import type { AnyNode } from "domhandler";
import type { WpContentRecord } from "./types";
import { normalizeRoutePath } from "./url";

const JOB_APPLICATION_PATH = "/ข่าวสาร-กิจกรรม/ร่วมงานกับ-สทร/สมัครงาน";
const PREVIOUS_NOTICE_DATE = "28 กันยายน 2569";
const TARGET_POSITION = "เจ้าหน้าที่สนับสนุนงานนโยบายและแผน";
const APPLICATION_URL = "https://forms.gle/z3abJcX9QRk8zGGA7";
const NOTICE_DOCUMENT_URL = "/job-application-policy-planning-support-25691001.pdf";

function isJobApplicationPath(path: string): boolean {
  return normalizeRoutePath(path).replace(/^\/en(?=\/)/, "") === JOB_APPLICATION_PATH;
}

export function applyJobApplicationNoticeOverride(
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

  const applicationCell = cells.eq(4);
  let applicationLink: Cheerio<AnyNode> = applicationCell.find("a").first();
  if (applicationLink.length === 0) {
    applicationCell.empty();
    applicationLink = $("<a></a>").text("สมัครงาน");
    applicationCell.append(applicationLink);
    changed = true;
  }
  if (applicationLink.attr("href") !== APPLICATION_URL) {
    applicationLink.attr("href", APPLICATION_URL);
    changed = true;
  }
  if (applicationLink.attr("target") !== "_blank") {
    applicationLink.attr("target", "_blank");
    changed = true;
  }
  if (applicationLink.attr("rel") !== "noreferrer noopener") {
    applicationLink.attr("rel", "noreferrer noopener");
    changed = true;
  }

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
