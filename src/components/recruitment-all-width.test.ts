import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
describe("standalone recruitment reader", () => {
  it("uses a canvas reader independently of viewport width", () => {
    const source = readFileSync(new URL("./content-page.tsx", import.meta.url), "utf8");
    expect(source.replace(/\s+/g, " ")).toContain(
      'record.path === "/Recruitment_Announcement_rtrda_1" && inlineRiskReportTarget',
    );
    expect(source.replace(/\s+/g, " ")).toContain("allWidths");
  });
  it("allows explicit all-width rendering without changing other document defaults", () => {
    const source = readFileSync(
      new URL("./inline-risk-report-pdf.tsx", import.meta.url),
      "utf8",
    );
    expect(source.replace(/\s+/g, " ")).toContain("allWidths = false");
    expect(source).toContain('style={allWidths ? { display: "grid" } : undefined}');
    expect(source.replace(/\s+/g, " ")).toContain("(!isMobile && !allWidths)");
    expect(source.replace(/\s+/g, " ")).toContain(
      "[isMobile, allWidths, target.inlineHref]",
    );
  });
});
