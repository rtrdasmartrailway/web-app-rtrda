import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { applyJobApplicationNoticeOverride } from "./job-application";
import type { WpContentRecord } from "./types";

function record(path: string, contentHtml: string): WpContentRecord {
  return {
    id: "job-application-test",
    wpId: "job-application-test",
    language: "th",
    kind: "page",
    path,
    sourceUrl: `https://test.rtrda.or.th${path}`,
    title: "สมัครงาน",
    excerpt: "",
    contentHtml,
    modified: "2026-09-28T00:00:00.000Z",
    date: "2026-09-28T00:00:00.000Z",
    parentPath: "/ข่าวสาร-กิจกรรม/ร่วมงานกับ-สทร",
    categoryIds: [],
    featuredMediaId: null,
    authorId: null,
  };
}

describe("applyJobApplicationNoticeOverride", () => {
  it("updates the notice and removes only its application link", () => {
    const source = record(
      "/ข่าวสาร-กิจกรรม/ร่วมงานกับ-สทร/สมัครงาน",
      `<table><tbody>
        <tr><td>1</td><td>28 กันยายน 2569</td><td>ประกาศเปิดรับสมัครงาน ตำแหน่ง เจ้าหน้าที่สนับสนุนงานนโยบายและแผน (จ้างเหมาบริการ)</td><td>1</td><td><a href="/old-form">สมัครงาน</a></td><td><a href="/old.pdf">PDF</a></td></tr>
        <tr><td>2</td><td>23 เมษายน 2569</td><td>ประกาศเดิม</td><td>–</td><td><a href="/older-form">สมัครงาน</a></td><td><a href="/older.pdf">PDF</a></td></tr>
      </tbody></table>`,
    );

    const updated = applyJobApplicationNoticeOverride(source);
    const $ = cheerio.load(updated.contentHtml, null, false);
    const rows = $("tbody tr").toArray();
    const eligibleCandidatesNotice = $(rows[0]);
    const notice = $(rows[2]);

    expect($("tbody tr")).toHaveLength(4);
    expect(rows.map((row) => $(row).find("td").first().text())).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
    expect(eligibleCandidatesNotice.find("td").eq(1).text()).toBe("23 พฤศจิกายน 2569");
    expect(eligibleCandidatesNotice.find("td").eq(2).text()).toBe(
      "ประกาศรายชื่อผู้มีสิทธิ์เข้ารับการสอบคัดเลือกเป็นเจ้าหน้าที่ของสถาบันฯ ครั้งที่ 2/2569",
    );
    expect(eligibleCandidatesNotice.find("td").eq(3).text()).toBe("–");
    expect(eligibleCandidatesNotice.find("td").eq(4).text()).toBe("–");
    expect(eligibleCandidatesNotice.find("td").eq(5).find("a").attr("href")).toBe(
      "/recruitment-documents/eligible-candidates-staff-selection-2-25691123.pdf",
    );
    expect(eligibleCandidatesNotice.find("td").eq(5).find("a").attr("target")).toBe(
      "_blank",
    );
    expect(eligibleCandidatesNotice.find("td").eq(5).find("a").attr("rel")).toBe(
      "noreferrer noopener",
    );
    expect(eligibleCandidatesNotice.find("td").eq(5).find("a").text()).toBe("PDF");

    expect($(rows[1]).find("td").eq(1).text()).toBe("18 พฤศจิกายน 2569");
    expect($(rows[1]).find("td").eq(2).text()).toContain(
      "นักวิเคราะห์วิชาการ / อาวุโส (วิศวกร)",
    );
    expect($(rows[1]).find("td").eq(5).find("a").attr("href")).toBe(
      "/recruitment-documents/eligible-candidates-engineer-25691118.pdf",
    );
    expect(notice.find("td").eq(1).text()).toBe("1 ตุลาคม 2569");
    expect(notice.find("td").eq(2).text()).toBe(
      "ประกาศเปิดรับสมัครงาน ตำแหน่ง เจ้าหน้าที่สนับสนุนงานนโยบายและแผน (จ้างเหมาบริการ)",
    );
    expect(notice.find("td").eq(3).text()).toBe("1 อัตรา");
    expect(notice.find("td").eq(4).text()).toBe("–");
    expect(notice.find("td").eq(4).find("a")).toHaveLength(0);
    expect(notice.find("td").eq(5).find("a").attr("href")).toBe(
      "/job-application-policy-planning-support-25691001.pdf",
    );
    expect(notice.find("td").eq(5).find("a").text()).toBe("PDF");
    expect($(rows[3]).find("td").eq(1).text()).toBe("23 เมษายน 2569");
    expect($(rows[3]).find("td").eq(4).find("a").attr("href")).toBe("/older-form");
    expect(applyJobApplicationNoticeOverride(updated)).toBe(updated);
  });

  it("leaves other pages untouched", () => {
    const source = record("/ข่าวสาร-กิจกรรม/ข่าว-กิจกรรม", "<p>ข่าว</p>");
    expect(applyJobApplicationNoticeOverride(source)).toBe(source);
  });
});
