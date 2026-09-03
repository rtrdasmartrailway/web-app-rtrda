import { describe, expect, it } from "vitest";
import { railStrategyPublicationGroups } from "./rail-strategy-publication";

describe("railStrategyPublicationGroups", () => {
  it("keeps the document section collapsed by default", () => {
    expect(railStrategyPublicationGroups[0].open).toBe(false);
  });

  it("includes an empty infographics section", () => {
    expect(railStrategyPublicationGroups).toContainEqual({
      title: "อินโฟกราฟฟิค",
      open: false,
      documents: [],
    });
  });
});
