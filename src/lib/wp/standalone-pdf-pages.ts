import { normalizeRoutePath } from "./url";

export const recruitmentAnnouncementPath = "/Recruitment_Announcement_rtrda_1";
export const recruitmentAnnouncementTitle =
  "ประกาศสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) เรื่อง รับสมัครบุคคลเพื่อคัดเลือกและบรรจุแต่งตั้งเป็นเจ้าหน้าที่ ครั้งที่ 2/2569";

const recruitmentAnnouncementPdfPath =
  "/recruitment-documents/recruitment-staff-selection-2-2569.pdf?v=20261028-65fb0227";

function standalonePdfContent(title: string, pdfPath: string): string {
  return `<div class="standalone-pdf-page"><p><a href="${pdfPath}" target="_blank" rel="noreferrer" data-pdf-reader-ignore="true">เปิด PDF ในแท็บใหม่</a></p><iframe src="${pdfPath}#toolbar=1&navpanes=1&view=FitH" title="${title}" loading="lazy"></iframe></div>`;
}

export function getStandalonePdfPage(path: string) {
  const normalized = normalizeRoutePath(path).normalize("NFC");
  if (normalized !== recruitmentAnnouncementPath) {
    return null;
  }

  return {
    slug: "recruitment-announcement-rtrda-1",
    path: recruitmentAnnouncementPath,
    title: recruitmentAnnouncementTitle,
    contentHtml: standalonePdfContent(
      recruitmentAnnouncementTitle,
      recruitmentAnnouncementPdfPath,
    ),
  };
}
