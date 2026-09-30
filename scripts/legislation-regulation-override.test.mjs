import { describe, expect, it } from "vitest";
import { updateDirectorRegulation } from "./legislation-regulation-override.mjs";

const NEW_TITLE =
  "ระเบียบคณะกรรมการสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง ว่าด้วยหลักเกณฑ์และวิธีการสรรหาผู้อำนวยการสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง พ.ศ. 2569";
const PDF_URL = "/recruitment-director-regulation-2569.pdf";

describe("director regulation seed override", () => {
  it("updates only the director regulation title and download link", () => {
    const html = `<div><table><tbody><tr><td>ระเบียบคณะกรรมการสถาบันวิจัยและพัฒนาเทคโนโลยีระบบรางว่าด้วยหลักเกณฑ์และวิธีสรรหาผู้อำนวยการ สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง พ.ศ. 2564</td><td><a href="/old.pdf">ดาวน์โหลด PDF</a></td></tr><tr><td>ระเบียบรายการอื่น</td><td><a href="/other.pdf">ดาวน์โหลด PDF</a></td></tr></tbody></table></div>`;

    const result = updateDirectorRegulation(html);

    expect(result).toContain(NEW_TITLE);
    expect(result).toContain(`href="${PDF_URL}"`);
    expect(result).toContain("ระเบียบรายการอื่น");
    expect(result).toContain('href="/other.pdf"');
    expect(result).not.toContain("/old.pdf");
  });

  it("is idempotent", () => {
    const html = `<table><tbody><tr><td>${NEW_TITLE}</td><td><a href="${PDF_URL}">ดาวน์โหลด PDF</a></td></tr></tbody></table>`;
    expect(updateDirectorRegulation(updateDirectorRegulation(html))).toBe(
      updateDirectorRegulation(html),
    );
  });

  it("fails if the target row is not uniquely identifiable", () => {
    expect(() => updateDirectorRegulation("<table><tbody></tbody></table>")).toThrow(
      "Expected one director regulation row, found 0",
    );
  });
});
