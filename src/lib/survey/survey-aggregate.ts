// Only static labels and numeric aggregates may cross the public API boundary.
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
  const text = value?.trim() ?? "";
  if (/มหาวิทยาลัย|สถาบันการศึกษา|สถานศึกษา|วิทยาลัย/.test(text)) return "สถาบันการศึกษา";
  if (/รัฐวิสาหกิจ/.test(text)) return "รัฐวิสาหกิจ";
  if (/หน่วยงานภาครัฐ|ราชการ|ภาครัฐ|กระทรวง|กรม/.test(text)) return "หน่วยงานภาครัฐ";
  if (/บริษัท|เอกชน|อุตสาหกรรม/.test(text)) return "ภาคเอกชน";
  return "อื่น ๆ";
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
    organizationTypes: Array.from(types, ([label, count]) => ({ label, count }))
      .filter(({ count }) => count >= 3)
      .sort((a, b) => b.count - a.count),
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
