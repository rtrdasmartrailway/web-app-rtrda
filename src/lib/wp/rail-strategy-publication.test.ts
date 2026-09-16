import { describe, expect, it } from "vitest";
import { railStrategyPublicationGroups } from "./rail-strategy-publication";

describe("railStrategyPublicationGroups", () => {
  it("keeps the document section collapsed by default", () => {
    expect(railStrategyPublicationGroups[0].open).toBe(false);
  });

  it("includes the six infographics in source order", () => {
    const infographics = railStrategyPublicationGroups.find(
      (group) => group.title === "อินโฟกราฟฟิค",
    )?.infographics;

    expect(infographics).toHaveLength(6);
    expect(infographics?.map((infographic) => infographic.src)).toEqual([
      "/infographics/rail-technology-strategy-2571-2575/1.svg",
      "/infographics/rail-technology-strategy-2571-2575/2.svg",
      "/infographics/rail-technology-strategy-2571-2575/3.svg",
      "/infographics/rail-technology-strategy-2571-2575/4.svg",
      "/infographics/rail-technology-strategy-2571-2575/5.svg",
      "/infographics/rail-technology-strategy-2571-2575/6.svg",
    ]);
  });
});
