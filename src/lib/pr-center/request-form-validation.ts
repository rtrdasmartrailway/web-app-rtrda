export type RequestFormIssue =
  | "title"
  | "assigner"
  | "owner"
  | "requestedDate"
  | "source"
  | "confirmation"
  | "objective"
  | "whyNow"
  | "audience"
  | "contentTypes"
  | "priority"
  | "startTime"
  | "endTime"
  | "travel"
  | "whyNowLength"
  | "priorityReason"
  | "projectDetails";

export type RequestFormValues = {
  type: "pr" | "offsite";
  title: string;
  assigner: string;
  owner: string;
  requestedDate: string;
  source: string;
  confirmed: boolean;
  objective: string;
  whyNow: string;
  audience: string;
  contentTypes: string[];
  priority: string;
  priorityReason: string;
  projectDetails: string;
  startTime: string;
  endTime: string;
  travel: string;
};

export function getRequestFormIssue(
  values: RequestFormValues,
  allowedContentTypes: readonly string[] = values.contentTypes,
): RequestFormIssue | null {
  if (values.title.trim().length < 3 || values.title.trim().length > 300) return "title";
  if (!values.assigner.trim() || values.assigner.trim().length > 200) return "assigner";
  if (!values.owner.trim() || values.owner.trim().length > 200) return "owner";
  const date = new Date(`${values.requestedDate}T00:00:00.000Z`);
  if (
    !values.requestedDate ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== values.requestedDate
  )
    return "requestedDate";

  const sourceUrls = values.source
    .split(/\n+/)
    .map((url) => url.trim())
    .filter(Boolean);
  if (
    sourceUrls.length === 0 ||
    sourceUrls.length > 100 ||
    sourceUrls.some((value) => value.length > 2048)
  )
    return "source";
  if (
    sourceUrls.some((value) => {
      try {
        return new URL(value).protocol !== "https:";
      } catch {
        return true;
      }
    })
  )
    return "source";

  if (!values.confirmed) return "confirmation";
  if (values.type === "pr") {
    if (!values.objective.trim()) return "objective";
    if (!values.whyNow.trim()) return "whyNow";
    if (values.whyNow.trim().length > 5000) return "whyNowLength";
    if (!values.audience.trim()) return "audience";
    if (
      values.contentTypes.length === 0 ||
      values.contentTypes.length > 100 ||
      values.contentTypes.some((value) => !allowedContentTypes?.includes(value))
    )
      return "contentTypes";
    if (!["LOW", "NORMAL", "HIGH", "URGENT"].includes(values.priority)) return "priority";
    if (values.priorityReason.trim().length > 1000) return "priorityReason";
  } else {
    if (values.projectDetails.trim().length > 5000) return "projectDetails";
    if (!values.startTime) return "startTime";
    if (!values.endTime || values.endTime <= values.startTime) return "endTime";
    if (!values.travel.trim() || values.travel.trim().length > 200) return "travel";
  }
  return null;
}

export function requestFormIssueMessage(issue: RequestFormIssue, thai: boolean): string {
  const messages: Record<RequestFormIssue, readonly [string, string]> = {
    title: [
      "กรอกชื่อโครงการอย่างน้อย 3 และไม่เกิน 300 ตัวอักษร",
      "Enter a project name between 3 and 300 characters.",
    ],
    assigner: [
      "กรอกชื่อผู้มอบหมายงาน (ไม่เกิน 200 ตัวอักษร)",
      "Enter the assigner's name (up to 200 characters).",
    ],
    owner: [
      "กรอกชื่อเจ้าของโครงการ (ไม่เกิน 200 ตัวอักษร)",
      "Enter the project owner's name (up to 200 characters).",
    ],
    requestedDate: ["เลือกวันที่ต้องการ", "Choose the requested date."],
    source: [
      "กรอกลิงก์ข้อมูลต้นทางที่ถูกต้อง โดยใช้ HTTPS (ใส่หลายลิงก์แยกบรรทัดได้)",
      "Add at least one valid HTTPS source link; put each link on a separate line.",
    ],
    confirmation: [
      "ยืนยันว่าข้อมูลต้นทางถูกต้องและตรวจสอบได้",
      "Confirm that the source information is accurate and verifiable.",
    ],
    objective: ["กรอกวัตถุประสงค์การสื่อสาร", "Enter the communication objective."],
    whyNow: [
      "ระบุเหตุผลที่ต้องสื่อสารในช่วงนี้",
      "Explain why this communication is needed now.",
    ],
    audience: ["ระบุกลุ่มเป้าหมาย", "Enter the target audience."],
    contentTypes: [
      "เลือกประเภทเนื้อหาอย่างน้อย 1 ประเภท",
      "Choose at least one content type.",
    ],
    priority: ["เลือกระดับความสำคัญ", "Choose a priority."],
    startTime: ["เลือกเวลาเริ่มต้น", "Choose a start time."],
    endTime: [
      "เลือกเวลาสิ้นสุดที่หลังเวลาเริ่มต้น",
      "Choose an end time after the start time.",
    ],
    travel: [
      "ระบุรูปแบบการเดินทาง (ไม่เกิน 200 ตัวอักษร)",
      "Choose a travel arrangement (up to 200 characters).",
    ],
    whyNowLength: [
      "เหตุผลที่ต้องสื่อสารต้องไม่เกิน 5,000 ตัวอักษร",
      "The reason must be 5,000 characters or fewer.",
    ],
    priorityReason: [
      "เหตุผลประกอบความสำคัญต้องไม่เกิน 1,000 ตัวอักษร",
      "The priority reason must be 1,000 characters or fewer.",
    ],
    projectDetails: [
      "รายละเอียดโครงการต้องไม่เกิน 5,000 ตัวอักษร",
      "Project details must be 5,000 characters or fewer.",
    ],
  };
  return messages[issue][thai ? 0 : 1];
}
