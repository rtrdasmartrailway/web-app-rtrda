// Aggregate labels are safe only behind the dashboard authentication boundary.
const SECTIONS = [
  { label: "วิจัยและพัฒนา", start: 14 },
  { label: "มาตรฐานและการรับรอง", start: 24 },
  { label: "พัฒนาบุคลากร", start: 36 },
  { label: "ถ่ายทอดเทคโนโลยี", start: 46 },
  { label: "ด้านอื่น ๆ", start: 56 },
] as const;

function score(value: string | undefined): number | null {
  const match = value?.trim().match(/^([0-5])(?:\s|$|[.:\-–])/);
  return match ? Number(match[1]) : null;
}

function organizationType(value: string | undefined): string {
  const text = (value ?? "").trim().replace(/[\x00-\x1f\x7f]+/g, " ");
  // Keep the actual fixed choice or the respondent-specified subtype instead
  // of collapsing distinct organizations into a misleading "other" bucket.
  if (!text || /^[=+@]/.test(text)) return "ไม่ระบุประเภท";
  return text.slice(0, 120);
}

export function aggregateSurvey(rows: string[][], updatedAt: string) {
  // Header is never a respondent. Ignore entirely blank records.
  const responses = rows.slice(1).filter((row) => row.some((cell) => cell?.trim()));
  const types = new Map<string, number>();
  for (const row of responses) {
    const label = organizationType(row[5]);
    types.set(label, (types.get(label) ?? 0) + 1);
  }
  return {
    totalResponses: responses.length,
    updatedAt,
    organizationTypes: Array.from(types, ([label, count]) => ({ label, count })).sort(
      (a, b) => {
        const codeA = Number(/^\((\d+)\)/.exec(a.label)?.[1] ?? 99);
        const codeB = Number(/^\((\d+)\)/.exec(b.label)?.[1] ?? 99);
        return codeA - codeB || a.label.localeCompare(b.label, "th");
      },
    ),
    sections: SECTIONS.map(({ label, start }) => {
      let completed = 0;
      let sum = 0;
      let scored = 0;
      for (const row of responses) {
        let answered = false;
        for (let index = start; index < start + 6; index++) {
          const value = score(row[index]);
          if (value === null) continue;
          answered = true;
          sum += value;
          scored++;
        }
        if (answered) completed++;
      }
      return {
        label,
        completed,
        mean: scored ? Math.round((sum / scored) * 10) / 10 : null,
      };
    }),
  };
}

export type SurveySummary = ReturnType<typeof aggregateSurvey>;
