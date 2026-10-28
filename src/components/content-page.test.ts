import { describe, expect, it } from "vitest";
import { contentRouteClass } from "./content-page";

describe("contentRouteClass", () => {
  it("activates board executive responsive styles for Thai and English routes", () => {
    expect(contentRouteClass("/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร")).toBe(
      "content-board-executives",
    );
    expect(contentRouteClass("/en/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร")).toBe(
      "content-board-executives",
    );
  });

  it("keeps standards route styling intact", () => {
    expect(contentRouteClass("/มาตรฐานระบบราง-สทร")).toBe("content-rail-standards");
  });
});

import { inlineMobilePdfTarget } from "./content-page";
import type { PdfReaderTarget } from "@/lib/wp/pdf-reader";
const recruitmentTarget: PdfReaderTarget = {
  sourceHref: "/recruitment-documents/notice.pdf",
  inlineHref: "/recruitment-documents/notice.pdf?v=current",
  downloadHref: "/recruitment-documents/notice.pdf?v=current",
  title: "Recruitment",
  kind: "upload",
};
describe("inline mobile PDF selection", () => {
  it("uses the canvas reader on the standalone recruitment page", () => {
    expect(
      inlineMobilePdfTarget("/Recruitment_Announcement_rtrda_1", [recruitmentTarget]),
    ).toBe(recruitmentTarget);
  });
  it("does not replace the recruitment listing with a document", () => {
    expect(
      inlineMobilePdfTarget("/ข่าวสาร-กิจกรรม/ร่วมงานกับ-สทร/สมัครงาน", [
        recruitmentTarget,
      ]),
    ).toBeUndefined();
  });
  it("preserves the risk report reader", () => {
    const risk = {
      ...recruitmentTarget,
      sourceHref: "/risk-reports/no-gift-policy/report-2569.pdf",
    };
    expect(inlineMobilePdfTarget("/policy_no_gift_policy_2569", [risk])).toBe(risk);
  });
});
