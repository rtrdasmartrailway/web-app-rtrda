import { describe, expect, it } from "vitest";
import { addRecruitmentNotice } from "./recruitment-notice-override.mjs";

const FORM_URL = "https://forms.gle/z3abJcX9QRk8zGGA7";
const PDF_URL = "/recruitment-documents/recruitment-policy-planning-support-2569.pdf";

describe("recruitment notice database override", () => {
  it("prepends the new notice and increments existing row numbers", () => {
    const html =
      "<figure><table><thead><tr><th>Date</th></tr></thead><tbody><tr><td>1</td><td>23 เมษายน 2569</td></tr><tr><td>2</td><td>17 เมษายน 2569</td></tr></tbody></table></figure>";

    const result = addRecruitmentNotice(html);

    expect(result).toContain("28 กันยายน 2569");
    expect(result).toContain("เจ้าหน้าที่สนับสนุนงานนโยบายและแผน");
    expect(result).toContain('href="' + FORM_URL + '"');
    expect(result).toContain('href="' + PDF_URL + '"');
    expect(result.indexOf("28 กันยายน 2569")).toBeLessThan(
      result.indexOf("23 เมษายน 2569"),
    );
    expect(result).toContain("<tbody><tr");
    expect(result).toContain(">2</td><td>23 เมษายน 2569");
    expect(result).toContain(">3</td><td>17 เมษายน 2569");
  });

  it("is idempotent", () => {
    const html = "<table><tbody><tr><td>1</td><td>รายการเดิม</td></tr></tbody></table>";
    const once = addRecruitmentNotice(html);

    expect(addRecruitmentNotice(once)).toBe(once);
  });
});
