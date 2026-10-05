// Functional similarity, not a finding of duplicate projects or budget.
export const SURVEY_AREAS = [
  { label: "วิจัยและพัฒนา", start: 14 },
  { label: "มาตรฐาน การทดสอบและการรับรอง", start: 24 },
  { label: "พัฒนากำลังคน", start: 36 },
  { label: "รับและถ่ายทอดเทคโนโลยี", start: 46 },
  { label: "พัฒนาอุตสาหกรรมและระบบนิเวศ", start: 56 },
] as const;

type Response = { sheetRow: number; cells: string[] };

function role(value: string | undefined): number | null {
  const match = value?.trim().match(/^([0-4])(?:\s|$|[.:\-–])/);
  return match ? Number(match[1]) : null;
}

function organizationKey(row: Response): string {
  return (
    row.cells[2]?.trim().replace(/\s+/g, "").toLocaleLowerCase() ||
    `missing-${row.sheetRow}`
  );
}

// Deliberately narrow: ambiguous or unspecified affiliations stay out of the อว. view.
export function isClearlyMohe(affiliation: string | undefined): boolean {
  return /อว\.?|อุดมศึกษา/i.test(affiliation ?? "");
}

export type SurveyAffiliation = "mohe" | "nonmohe" | "unknown";
export type SurveyScope = "all" | "mohe" | "nonmohe";

// The form asks for a parent organization, not whether two agencies collaborate.
// An unclear parent must not be labeled "unrelated to อว." by subtraction.
export function classifySurveyAffiliation(value: string | undefined): SurveyAffiliation {
  const affiliation = value?.trim() ?? "";
  if (isClearlyMohe(affiliation)) return "mohe";
  if (
    /กระทรวง|สำนักนายกรัฐมนตรี|นายกรัฐมนตรี|การรถไฟ|รฟม|สนข|ขร\.|BOI|กสอ|อุตสาหกรรมพัฒนามูลนิธิ|สำนักงานเศรษฐกิจอุตสาหกรรม|สำนักงานคณะกรรมการส่งเสริมการลงทุน|สำนักงานคณะกรรมการการอาชีวศึกษา/.test(
      affiliation,
    )
  )
    return "nonmohe";
  return "unknown";
}

export function buildSurveyHeatmap(
  headers: string[],
  responses: Response[],
  scope: SurveyScope,
) {
  const latest = new Map<string, Response>();
  for (const response of responses) latest.set(organizationKey(response), response);
  const all = [...latest.values()];
  const scopeCounts = { mohe: 0, nonmohe: 0, unknown: 0 };
  for (const response of all) scopeCounts[classifySurveyAffiliation(response.cells[6])]++;
  const filtered = all.filter(
    (response) =>
      scope === "all" || classifySurveyAffiliation(response.cells[6]) === scope,
  );
  const rows = filtered
    .map((response) => ({
      sheetRow: response.sheetRow,
      name: response.cells[2]?.trim() || `ไม่ระบุหน่วยงาน (แถว ${response.sheetRow})`,
      affiliation: classifySurveyAffiliation(response.cells[6]),
      areas: SURVEY_AREAS.map((area) => {
        const activities = Array.from({ length: 6 }, (_, offset) => {
          const column = area.start + offset;
          return {
            column,
            title:
              /\[([^\]]+)\]/.exec(headers[column] ?? "")?.[1] || `กิจกรรม ${offset + 1}`,
            score: role(response.cells[column]),
          };
        });
        return {
          label: area.label,
          direct: activities.filter(
            (activity) => activity.score !== null && activity.score >= 3,
          ).length,
          answered: activities.filter((activity) => activity.score !== null).length,
          activities,
        };
      }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));
  return { rows, scopeCounts, responseCount: responses.length };
}

export function buildSurveyOverlap(
  headers: string[],
  responses: Response[],
  moheOnly: boolean,
) {
  // One record per named agency: latest sheet row takes precedence. Preserve the
  // source row so a reviewer can open its full answer, including supporting text.
  const latest = new Map<string, Response>();
  for (const response of responses) latest.set(organizationKey(response), response);
  const agencies = [...latest.values()].filter(
    (response) => !moheOnly || isClearlyMohe(response.cells[6]),
  );
  const areas = SURVEY_AREAS.map((area) => ({
    label: area.label,
    activities: Array.from({ length: 6 }, (_, offset) => {
      const column = area.start + offset;
      const header = headers[column] ?? "";
      const title = /\[([^\]]+)\]/.exec(header)?.[1] || `กิจกรรม ${offset + 1}`;
      const direct = agencies
        .flatMap((response) => {
          const score = role(response.cells[column]);
          return score !== null && score >= 3
            ? [
                {
                  sheetRow: response.sheetRow,
                  name: response.cells[2]?.trim() || "ไม่ระบุหน่วยงาน",
                  score,
                },
              ]
            : [];
        })
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "th"));
      const supporting = agencies.filter(
        (response) => role(response.cells[column]) === 2,
      ).length;
      const answered = agencies.filter(
        (response) => role(response.cells[column]) !== null,
      ).length;
      return { column, title, direct, supporting, answered };
    }),
  }));
  return {
    agencyCount: agencies.length,
    responseCount: responses.length,
    similarActivityCount: areas
      .flatMap((area) => area.activities)
      .filter((a) => a.direct.length > 0).length,
    areas,
  };
}
