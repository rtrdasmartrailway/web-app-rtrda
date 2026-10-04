import { describe, expect, it } from "vitest";
import { parseCurrentMessageHouse, parseMessageHouseHistory } from "./message-house-view";

const currentVersion = {
  versionNumber: 4,
  vision: "Vision as approved",
  positioning: "Positioning as approved",
  pillars: ["Safety", "Research"],
  foundation: "Evidence and service",
  effectiveAt: "2026-09-01T00:00:00.000Z",
};

describe("parseCurrentMessageHouse", () => {
  it("accepts only the currently effective content returned by the API", () => {
    expect(parseCurrentMessageHouse(currentVersion)).toEqual(currentVersion);
  });

  it("returns null when no approved effective version exists", () => {
    expect(parseCurrentMessageHouse(null)).toBeNull();
  });

  it("rejects malformed payloads rather than presenting demo content", () => {
    expect(() =>
      parseCurrentMessageHouse({ ...currentVersion, pillars: ["Safety", 5] }),
    ).toThrow("Invalid current Message House response");
    expect(() =>
      parseCurrentMessageHouse({ ...currentVersion, effectiveAt: "not-a-date" }),
    ).toThrow("Invalid current Message House response");
  });

  it("parses a version history and rejects malformed history responses", () => {
    expect(parseMessageHouseHistory([currentVersion])).toEqual([currentVersion]);
    expect(() => parseMessageHouseHistory({ data: [currentVersion] })).toThrow(
      "Invalid Message House history response",
    );
  });
});
