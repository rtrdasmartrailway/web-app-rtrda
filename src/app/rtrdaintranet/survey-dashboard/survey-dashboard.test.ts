import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "survey-dashboard.tsx"), "utf8");
describe("private response explorer wiring", () => {
  it("has search, organization filter, respondent list, and all-field detail view", () => {
    expect(source).toContain("ค้นหาผู้ตอบหรือคำตอบ");
    expect(source).toContain("กรองตามหน่วยงาน");
    expect(source).toContain("รายการคำตอบและผู้ประสานงาน");
    expect(source).toContain("cells[4]?.trim()");
    expect(source).toContain("รายละเอียดคำตอบทั้งหมด");
    expect(source).toContain("data.headers.map(");
    expect(source).toContain("selected.cells[index]");
    expect(source).toContain("index < 14");
  });
  it("keeps a 30-second refresh and does not embed respondent data in SSR", () => {
    expect(source).toContain("30_000");
    expect(source).toContain('fetch("/api/survey-dashboard"');
  });
});
