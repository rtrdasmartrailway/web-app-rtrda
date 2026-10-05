import { SURVEY_AREAS } from "./survey-overlap";

// Use each form question's numbered section, not column ranges: follow-up
// questions for sections 2–6 occur again near the end of the response sheet.
export function buildSurveyDetailGroups(headers: string[]) {
  const overview: number[] = [];
  const groups = SURVEY_AREAS.map((area, index) => ({
    number: index + 2,
    label: area.label,
    indices: [] as number[],
  }));
  headers.forEach((header, index) => {
    const section = header.trim().match(/^([2-6])\.\d/);
    if (section) groups[Number(section[1]) - 2].indices.push(index);
    else overview.push(index);
  });
  return { overview, groups };
}
