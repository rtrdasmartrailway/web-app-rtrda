import { describe, expect, it } from "vitest";
import { railStrategyPublicationGroups } from "./rail-strategy-publication";

describe("railStrategyPublicationGroups", () => {
  it("includes an empty infographics section", () => {
    expect(railStrategyPublicationGroups).toContainEqual({
      title: "อินโฟกราฟฟิค",
      open: false,
      documents: [],
    });
  });
});
