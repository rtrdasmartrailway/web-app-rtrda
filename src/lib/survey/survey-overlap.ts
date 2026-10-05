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
