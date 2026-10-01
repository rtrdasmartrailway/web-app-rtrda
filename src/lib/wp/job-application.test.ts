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
  it("updates the existing 28 September notice with the October 1 links", () => {
    const source = record(
      "/ข่าวสาร-กิจกรรม/ร่วมงานกับ-สทร/สมัครงาน",
      `<table><tbody>
        <tr><td>1</td><td>28 กันยายน 2569</td><td>ประกาศเปิดรับสมัครงาน ตำแหน่ง เจ้าหน้าที่สนับสนุนงานนโยบายและแผน (จ้างเหมาบริการ)</td><td>1</td><td><a href="/old-form">สมัครงาน</a></td><td><a href="/old.pdf">PDF</a></td></tr>
        <tr><td>2</td><td>23 เมษายน 2569</td><td>ประกาศเดิม</td><td>–</td><td>–</td><td><a href="/older.pdf">PDF</a></td></tr>
      </tbody></table>`,
    );

    const updated = applyJobApplicationNoticeOverride(source);
    const $ = cheerio.load(updated.contentHtml, null, false);
    const rows = $("tbody tr").toArray();
    const notice = $(rows[0]);

    expect($("tbody tr")).toHaveLength(2);
    expect(notice.find("td").eq(1).text()).toBe("1 ตุลาคม 2569");
    expect(notice.find("td").eq(2).text()).toBe(
      "ประกาศเปิดรับสมัครงาน ตำแหน่ง เจ้าหน้าที่สนับสนุนงานนโยบายและแผน (จ้างเหมาบริการ)",
    );
    expect(notice.find("td").eq(3).text()).toBe("1 อัตรา");
    expect(notice.find("td").eq(4).find("a").attr("href")).toBe(
      "https://forms.gle/z3abJcX9QRk8zGGA7",
    );
    expect(notice.find("td").eq(5).find("a").attr("href")).toBe(
      "/job-application-policy-planning-support-25691001.pdf",
    );
    expect(notice.find("td").eq(5).find("a").text()).toBe("PDF");
    expect($(rows[1]).find("td").eq(1).text()).toBe("23 เมษายน 2569");
    expect(applyJobApplicationNoticeOverride(updated)).toBe(updated);
  });

  it("leaves other pages untouched", () => {
    const source = record("/ข่าวสาร-กิจกรรม/ข่าว-กิจกรรม", "<p>ข่าว</p>");
    expect(applyJobApplicationNoticeOverride(source)).toBe(source);
  });
});
