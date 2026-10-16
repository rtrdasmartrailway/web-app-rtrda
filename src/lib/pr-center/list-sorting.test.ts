import { describe, expect, it } from "vitest";
import { compareIdeaPriorities } from "./list-sorting";

describe("semantic priority order", () => {
  it("ranks Thai and English values by importance with legacy text and blanks last", () => {
    const values = [
      null,
      "HIGH",
      "LOW",
      "URGENT",
      "NORMAL",
      "สูง",
      "เร่งด่วน",
      "Other",
      "",
    ];
    expect(
      [...values].sort((a, b) => compareIdeaPriorities(a, b, false)).slice(0, 6),
    ).toEqual(["LOW", "NORMAL", "สูง", "HIGH", "เร่งด่วน", "URGENT"]);
    const descending = [...values].sort((a, b) => compareIdeaPriorities(a, b, true));
    expect(new Set(descending.slice(0, 2))).toEqual(new Set(["เร่งด่วน", "URGENT"]));
    expect(descending.slice(-2)).toEqual(["", null]);
  });
});
