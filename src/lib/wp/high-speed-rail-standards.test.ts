import { describe, expect, it } from "vitest";
import {
  additionalHighSpeedRailStandardDocuments,
  buildHighSpeedRailPdfReaderTargets,
  extractRailStandardsCards,
  highSpeedRailStandardDocuments,
  importedHighSpeedRailStandardDocuments,
  stripImportedHighSpeedRailSection,
} from "./high-speed-rail-standards";

describe("high-speed rail standards override", () => {
  it("removes the malformed imported high-speed rail accordion only", () => {
    const cleaned = stripImportedHighSpeedRailSection(`
      <p></p>
      <div class="lightweight-accordion has-text-color">
        <details>
          <summary class="lightweight-accordion-title">
            <span><strong>มาตรฐานโครงการรถไฟความเร็วสูง</strong></span>
          </summary>
          <div class="lightweight-accordion-body">
            <div class="wp-block-columns">
              <div class="wp-block-column">
                <p></p><p <div="" class="wp-block-columns"></p>
                <div class="wp-block-column"><h6>มาตรฐานงานสำรวจ</h6></div>
              </div>
            </div>
          </div>
        </details>
      </div>
      <div class="lightweight-accordion has-text-color">
        <details>
          <summary class="lightweight-accordion-title">
            <span><strong>มาตรฐานอื่น</strong></span>
          </summary>
          <div class="lightweight-accordion-body"><p>ยังต้องแสดงอยู่</p></div>
        </details>
      </div>
    `);

    expect(cleaned).not.toContain("มาตรฐานโครงการรถไฟความเร็วสูง");
    expect(cleaned).not.toContain("มาตรฐานงานสำรวจ");
    expect(cleaned).toContain("มาตรฐานอื่น");
    expect(cleaned).toContain("ยังต้องแสดงอยู่");
  });

  it("keeps all high-speed rail files while using the approved tunnel standard titles", () => {
    expect(importedHighSpeedRailStandardDocuments).toHaveLength(7);
    expect(additionalHighSpeedRailStandardDocuments).toHaveLength(9);
    expect(highSpeedRailStandardDocuments).toHaveLength(16);
    expect(
      additionalHighSpeedRailStandardDocuments.map((document) => document.code),
    ).toEqual([
      "HSR-CT-1001",
      "HSR-CT-1002",
      "HSR-CT-3001",
      "HSR-CT-3002",
      "HSR-CT-3003",
      "HSR-CT-3004",
      "HSR-CT-4012",
      "HSR-CT-4013",
      "HSR-CT-5001",
    ]);
    expect(highSpeedRailStandardDocuments.map((document) => document.code)).toContain(
      "HSR-CT-3002",
    );
    expect(
      highSpeedRailStandardDocuments.slice(0, 4).map((document) => document.code),
    ).toEqual(["HSR-CT-3002", "HSR-CT-3003", "HSR-CT-3004", "HSR-CT-4013"]);
    expect(
      highSpeedRailStandardDocuments.slice(4, 9).map((document) => document.code),
    ).toEqual([
      "HSR-CT-1001",
      "HSR-CT-1002",
      "HSR-CT-3001",
      "HSR-CT-4012",
      "HSR-CT-5001",
    ]);
    expect(
      additionalHighSpeedRailStandardDocuments.find(
        (document) => document.code === "HSR-CT-1001",
      )?.title,
    ).toBe("มาตรฐานงานสำรวจวิศวกรรมในการก่อสร้างอุโมงค์ สำหรับโครงการรถไฟความเร็วสูง");
    expect(
      additionalHighSpeedRailStandardDocuments.find(
        (document) => document.code === "HSR-CT-5001",
      )?.title,
    ).toBe(
      "มาตรฐานการป้องกันและงานระบายน้ำในการก่อสร้างอุโมงค์ สำหรับโครงการรถไฟความเร็วสูง",
    );
  });

  it("adds one PDF reader target for each additional static PDF card", () => {
    const targets = buildHighSpeedRailPdfReaderTargets();
    expect(targets).toHaveLength(additionalHighSpeedRailStandardDocuments.length);
    expect(targets).toContainEqual(
      expect.objectContaining({
        sourceHref: "/standards/high-speed-rail/hsr-ct-1001-2568.pdf",
        title: expect.stringContaining("HSR-CT-1001 2568"),
      }),
    );
  });

  it("extracts the new rail standard card accordions before the high-speed section", () => {
    const { cardsHtml, restHtml } = extractRailStandardsCards(`
      <div class="lightweight-accordion"><details><summary>มาตรฐานโครงการรถไฟความเร็วสูง</summary></details></div>
      <div class="lightweight-accordion"><details><summary>แผนพัฒนามาตรฐานระบบขนส่งทางราง</summary><div class="lightweight-accordion-body"><div class="rtrda-rail-standards-files">card</div></div></details></div>
      <div class="lightweight-accordion"><details><summary>ประมวลมาตรฐานระบบขนส่งทางราง</summary><div class="lightweight-accordion-body"><div class="rtrda-rail-standards-files">card</div></div></details></div>
    `);

    expect(cardsHtml).toContain("แผนพัฒนามาตรฐานระบบขนส่งทางราง");
    expect(cardsHtml).toContain("ประมวลมาตรฐานระบบขนส่งทางราง");
    expect(restHtml).toContain("มาตรฐานโครงการรถไฟความเร็วสูง");
    expect(restHtml).not.toContain("แผนพัฒนามาตรฐานระบบขนส่งทางราง");
  });
});
