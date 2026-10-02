// Aggregate labels are safe only behind the dashboard authentication boundary.
const SECTIONS = [
  { label: "วิจัยและพัฒนา", start: 14 },
  { label: "มาตรฐานและการรับรอง", start: 24 },
  { label: "พัฒนาบุคลากร", start: 36 },
  { label: "ถ่ายทอดเทคโนโลยี", start: 46 },
  { label: "ด้านอื่น ๆ", start: 56 },
] as const;

const ORGANIZATION_CHOICES = [
  "(1) ส่วนราชการ/สำนักงานในกระทรวง",
  "(2) องค์การมหาชน",
  "(3) มหาวิทยาลัย/สถาบันอุดมศึกษา",
  "(4) สถาบันวิจัย/ศูนย์วิจัย/ห้องปฏิบัติการ",
  "(5) หน่วยบริหารและจัดการทุน",
  "(6) รัฐวิสาหกิจ",
  "(7) หน่วยงานมาตรฐาน/ทดสอบ/รับรอง",
  "(8) สมาคม/เครือข่ายวิชาชีพหรืออุตสาหกรรม",
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
  const counts = Array<number>(9).fill(0);
  const specified = new Set<string>();
  for (const row of responses) {
    const value = organizationType(row[5]);
    const fixedChoice = /^\(([1-8])\)/.exec(value);
    if (fixedChoice) counts[Number(fixedChoice[1]) - 1]++;
    else {
      counts[8]++;
      if (value !== "ไม่ระบุประเภท") specified.add(value);
    }
  }
  const specifiedValues = [...specified];
  const specifiedLabel = specifiedValues.length
    ? `ระบุเอง — ${specifiedValues.slice(0, 3).join(" · ")}${specifiedValues.length > 3 ? ` (+${specifiedValues.length - 3})` : ""}`
    : "ระบุเอง";
  return {
    totalResponses: responses.length,
    updatedAt,
    organizationTypes: [
      ...ORGANIZATION_CHOICES.map((label, index) => ({ label, count: counts[index] })),
      { label: `(9) ${specifiedLabel}`, count: counts[8] },
    ],
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
