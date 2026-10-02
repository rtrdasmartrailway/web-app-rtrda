import { describe, expect, it } from "vitest";
import { aggregateSurvey } from "./survey-aggregate";

function row(overrides: Record<number, string> = {}) {
  const cells = Array(73).fill("");
  cells[0] = "10/01/2026 08:00:00";
  cells[2] = "PRIVATE ORGANIZATION NAME";
  cells[4] = "secret@example.com";
  for (const start of [14, 24, 36, 46, 56]) {
    for (let i = start; i < start + 6; i++) cells[i] = "4";
  }
  for (const [index, value] of Object.entries(overrides)) cells[Number(index)] = value;
  return cells;
}

describe("aggregateSurvey", () => {
  it("returns exact category labels without respondent identifiers", () => {
    const result = aggregateSurvey(
      [
        Array(73).fill("heading"),
        row({ 5: "มหาวิทยาลัย" }),
        row({ 5: "มหาวิทยาลัย" }),
        row({ 5: "มหาวิทยาลัย" }),
      ],
      "2026-10-02T01:00:00.000Z",
    );
    expect(result.totalResponses).toBe(3);
    expect(result.updatedAt).toBe("2026-10-02T01:00:00.000Z");
    expect(result.sections).toHaveLength(5);
    expect(result.sections[0]).toMatchObject({ completed: 3, mean: 4 });
    expect(result.organizationTypes).toEqual([{ label: "มหาวิทยาลัย", count: 3 }]);
    const serialized = JSON.stringify(result);
    for (const secret of [
      "PRIVATE ORGANIZATION NAME",
      "secret@example.com",
      "10/01/2026",
      "heading",
    ])
      expect(serialized).not.toContain(secret);
  });

  it("keeps low-frequency fixed choices and sanitizes formula-like values", () => {
    const result = aggregateSurvey(
      [
        Array(73).fill(""),
        row({ 5: "บริษัทเอกชน", 14: "unknown", 15: "" }),
        row({
          5: '=HYPERLINK("secret")',
          14: "99",
          15: "",
          16: "",
          17: "",
          18: "",
          19: "",
        }),
        Array(73).fill(""),
      ],
      "2026-10-02T01:00:00.000Z",
    );
    expect(result.totalResponses).toBe(2);
    expect(result.organizationTypes).toEqual([
      { label: "บริษัทเอกชน", count: 1 },
      { label: "ไม่ระบุประเภท", count: 1 },
    ]);
    expect(result.sections[0]).toMatchObject({ completed: 1, mean: 4 });
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});
