import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "survey-heatmap.tsx"), "utf8");

describe("agency-by-domain heat map presentation", () => {
  it("shows exactly five domain headers above agency rows and the requested three filters", () => {
    expect(source).toContain('label: "ทั้งหมด"');
    expect(source).toContain('label: "เกี่ยวข้อง อว."');
    expect(source).toContain('label: "ไม่เกี่ยวข้อง อว."');
    expect(source).toContain("SURVEY_AREAS.map((area, index)");
    expect(source).toContain("data.rows.map((row)");
    expect(source).toContain('<th scope="row">');
  });
  it("shows total role score per category out of 24, not activity counts", () => {
    expect(source).toContain("area.scoreSum");
    expect(source).toContain("/ 24");
    expect(source).not.toContain("area.direct");
  });
});
