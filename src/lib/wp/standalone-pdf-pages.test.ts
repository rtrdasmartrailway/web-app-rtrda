import { describe, expect, it } from "vitest";
import {
  getStandalonePdfPage,
  recruitmentAnnouncementPath,
  recruitmentAnnouncementTitle,
} from "./standalone-pdf-pages";

describe("standalone PDF pages", () => {
  it("provides the recruitment announcement at its requested path", () => {
    const page = getStandalonePdfPage(recruitmentAnnouncementPath);

    expect(page).toMatchObject({
      path: "/Recruitment_Announcement_rtrda_1",
      title:
        "ประกาศสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) เรื่อง รับสมัครบุคคลเพื่อคัดเลือกและบรรจุแต่งตั้งเป็นเจ้าหน้าที่ ครั้งที่ 2/2569",
    });
    expect(page?.title).toBe(recruitmentAnnouncementTitle);
    expect(page?.contentHtml).toContain('<div class="standalone-pdf-page">');
    expect(page?.contentHtml).toContain(
      'href="/recruitment-documents/recruitment-staff-selection-2-2569.pdf?v=20261026-frame-headers"',
    );
    expect(page?.contentHtml).toContain(
      'src="/recruitment-documents/recruitment-staff-selection-2-2569.pdf?v=20261026-frame-headers#toolbar=1',
    );
  });

  it("returns no page for other paths", () => {
    expect(getStandalonePdfPage("/another-page")).toBeNull();
  });
});
