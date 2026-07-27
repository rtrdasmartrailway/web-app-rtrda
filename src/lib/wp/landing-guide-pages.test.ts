import { describe, expect, it } from "vitest";
import { getLandingGuidePage, landingGuidePages } from "./landing-guide-pages";
import { supplementalKnowledgePages } from "./knowledge-supplemental-documents";

const noGiftSupplementalPath = "/บริการและข้อมูลสำคัญ/no-gift-policy";
const noGiftNewsPath = "/สทร-ร่วมประกาศเจตนารมณ์-no-gift-policy-2569";

describe("landing guide pages", () => {
  it("keeps No Gift Policy only on /คู่มือO20 while accepting the legacy alias path", () => {
    expect(
      supplementalKnowledgePages.some(
        (page) => page.path === noGiftSupplementalPath || page.slug === "no-gift-policy",
      ),
    ).toBe(false);

    const o20Pages = landingGuidePages.filter((page) => page.path === "/คู่มือO20");
    expect(o20Pages).toHaveLength(1);
    expect(o20Pages[0].aliases).toContain(noGiftSupplementalPath);
  });

  it("shows the No Gift Policy news link as a card on /คู่มือO20", () => {
    const manualO20 = landingGuidePages.find((page) => page.path === "/คู่มือO20");
    const cards = manualO20?.groups.flatMap((group) => group.documents) ?? [];

    expect(cards.some((card) => card.previewHref === noGiftNewsPath)).toBe(true);
    expect(cards.find((card) => card.previewHref === noGiftNewsPath)).toMatchObject({
      downloadHref: null,
      hasUsableTarget: true,
    });
  });

  it("uses the correct Thai title for the ethics code documents", () => {
    const ethicsCode = supplementalKnowledgePages.find(
      (page) => page.slug === "ethics-code",
    );

    expect(ethicsCode?.groups[0]?.title).toBe("ประมวลจริยธรรม");
  });

  it("resolves requested compatibility paths to their canonical landing guide pages", () => {
    expect(getLandingGuidePage("/คู่มือO9/procurement-summary")?.path).toBe("/คู่มือO9");
    expect(getLandingGuidePage("/บริการและข้อมูลสำคัญ/no-gift-policy")?.path).toBe(
      "/คู่มือO20",
    );
  });
});
