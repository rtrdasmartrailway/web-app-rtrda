import { describe, expect, it } from "vitest";
import { landingGuidePages } from "./landing-guide-pages";
import { supplementalKnowledgePages } from "./knowledge-supplemental-documents";

const noGiftSupplementalPath = "/บริการและข้อมูลสำคัญ/no-gift-policy";
const noGiftNewsPath = "/สทร-ร่วมประกาศเจตนารมณ์-no-gift-policy-2569";

describe("landing guide pages", () => {
  it("keeps No Gift Policy only on /คู่มือO20, not as a supplemental service document page", () => {
    expect(
      supplementalKnowledgePages.some(
        (page) => page.path === noGiftSupplementalPath || page.slug === "no-gift-policy",
      ),
    ).toBe(false);

    expect(landingGuidePages.filter((page) => page.path === "/คู่มือO20")).toHaveLength(
      1,
    );
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
});
