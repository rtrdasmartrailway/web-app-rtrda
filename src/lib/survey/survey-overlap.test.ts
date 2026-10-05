import { describe, expect, it } from "vitest";
import { buildSurveyOverlap, isClearlyMohe } from "./survey-overlap";

const headers = Array(73).fill("");
for (const start of [14, 24, 36, 46, 56]) {
  for (let i = start; i < start + 6; i++) headers[i] = `2.1.1 [กิจกรรม ${i}]`;
}
function response(
  sheetRow: number,
  name: string,
  affiliation: string,
  scores: Record<number, string>,
) {
  const cells = Array(73).fill("");
  cells[2] = name;
  cells[6] = affiliation;
  for (const [index, value] of Object.entries(scores)) cells[Number(index)] = value;
  return { sheetRow, cells };
}

describe("survey functional similarity", () => {
  it("keeps all thirty activities, counts only direct 3-4, and separates support and missing", () => {
    const result = buildSurveyOverlap(
      headers,
      [
        response(2, "A", "กระทรวง อว.", { 14: "3 ดำเนินการ", 15: "2 สนับสนุน" }),
        response(3, "B", "กระทรวง อว", { 14: "4 บทบาทนำ", 15: "0 ไม่มีบทบาท" }),
        response(4, "C", "กระทรวงคมนาคม", { 14: "3 ดำเนินการ" }),
      ],
      true,
    );
    expect(result.areas.flatMap((area) => area.activities)).toHaveLength(30);
    expect(result.agencyCount).toBe(2);
    expect(result.similarActivityCount).toBe(1);
    expect(result.areas[0].activities[0].direct.map((a) => a.score)).toEqual([4, 3]);
    expect(result.areas[0].activities[1]).toMatchObject({
      supporting: 1,
      answered: 2,
      direct: [],
    });
  });
  it("uses the latest submission per agency name rather than summing duplicate answers", () => {
    const result = buildSurveyOverlap(
      headers,
      [
        response(2, "A B", "กระทรวง อว.", { 14: "4" }),
        response(9, "A  B", "กระทรวง อว.", { 14: "2" }),
      ],
      true,
    );
    expect(result.agencyCount).toBe(1);
    expect(result.areas[0].activities[0]).toMatchObject({ supporting: 1, direct: [] });
  });
  it("does not assign an ambiguous affiliation to อว.", () => {
    expect(isClearlyMohe("คณะวิศวกรรมศาสตร์")).toBe(false);
    expect(isClearlyMohe("กระทรวงการอุดมศึกษา วิทยาศาสตร์ วิจัยและนวัตกรรม")).toBe(true);
  });
});
