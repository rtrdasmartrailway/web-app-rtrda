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

  it("keeps the original cards and appends the replacement cards", () => {
    expect(importedHighSpeedRailStandardDocuments).toHaveLength(9);
    expect(additionalHighSpeedRailStandardDocuments).toHaveLength(5);
    expect(highSpeedRailStandardDocuments).toHaveLength(14);
  });

  it("adds one PDF reader target for each additional static PDF card", () => {
    expect(buildHighSpeedRailPdfReaderTargets()).toHaveLength(
      additionalHighSpeedRailStandardDocuments.length,
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
