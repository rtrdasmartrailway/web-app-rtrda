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
    expect(result.organizationTypes).toHaveLength(9);
    expect(result.organizationTypes[4]).toEqual({
      label: "(5) หน่วยบริหารและจัดการทุน",
      count: 0,
    });
    expect(result.organizationTypes[8]).toEqual({
      label: "(9) ระบุเอง — มหาวิทยาลัย",
      count: 3,
    });
    const serialized = JSON.stringify(result);
    for (const secret of [
      "PRIVATE ORGANIZATION NAME",
      "secret@example.com",
      "10/01/2026",
      "heading",
    ])
      expect(serialized).not.toContain(secret);
  });

  it("keeps all nine form choices and sanitizes formula-like custom values", () => {
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
    expect(result.organizationTypes).toHaveLength(9);
    expect(result.organizationTypes[8]).toEqual({
      label: "(9) ระบุเอง — บริษัทเอกชน",
      count: 2,
    });
    expect(result.sections[0]).toMatchObject({ completed: 1, mean: 4 });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("counts numbered choices separately and preserves zero-choice slots", () => {
    const result = aggregateSurvey(
      [
        Array(73).fill("heading"),
        row({ 5: "(2) องค์การมหาชน" }),
        row({ 5: "(7) หน่วยงานมาตรฐาน/ทดสอบ/รับรอง" }),
      ],
      "2026-10-02T01:00:00.000Z",
    );
    expect(result.organizationTypes).toHaveLength(9);
    expect(result.organizationTypes[1].count).toBe(1);
    expect(result.organizationTypes[4].count).toBe(0);
    expect(result.organizationTypes[6].count).toBe(1);
    expect(result.organizationTypes[8].count).toBe(0);
    expect(result.organizationTypes.reduce((sum, type) => sum + type.count, 0)).toBe(2);
  });
});
