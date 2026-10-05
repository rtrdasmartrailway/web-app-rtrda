import { describe, expect, it } from "vitest";
import { buildSurveyDetailGroups } from "./survey-detail-groups";

const headers = Array.from({ length: 73 }, (_, index) => {
  if (index < 14) return index === 0 ? "Timestamp" : `1.1.${index} ข้อมูลหน่วยงาน`;
  if (index === 72) return "14. โครงการภาพรวม";
  if (index >= 67) return `${index - 65}.2.2 แผน 3 ปี`;
  const section = index < 24 ? 2 : index < 36 ? 3 : index < 46 ? 4 : index < 56 ? 5 : 6;
  return `${section}.1.1 กิจกรรม`;
});

describe("survey response detail grouping", () => {
  it("places every one of the 73 sheet columns exactly once in overview or five sections", () => {
    const result = buildSurveyDetailGroups(headers);
    expect(result.groups).toHaveLength(5);
    expect(result.groups.map((group) => group.number)).toEqual([2, 3, 4, 5, 6]);
    expect(result.overview).toEqual([
      ...Array.from({ length: 14 }, (_, index) => index),
      72,
    ]);
    const indices = [
      ...result.overview,
      ...result.groups.flatMap((group) => group.indices),
    ];
    expect(indices.sort((a, b) => a - b)).toEqual(
      Array.from({ length: 73 }, (_, index) => index),
    );
  });
  it("files late plan questions under their numbered domain instead of appending them at the end", () => {
    const result = buildSurveyDetailGroups(headers);
    for (let i = 0; i < 5; i++) expect(result.groups[i].indices).toContain(67 + i);
    expect(result.groups[0].indices).toContain(14);
    expect(result.groups[4].indices).toContain(66);
  });
  it("keeps future unclassified columns visible in the overview", () => {
    const result = buildSurveyDetailGroups([...headers, "คำถามใหม่ไม่ระบุหมวด"]);
    expect(result.overview).toContain(73);
  });
});
