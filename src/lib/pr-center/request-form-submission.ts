import { RequestSubmissionError, validateRequestSubmission } from "./request-submission";

type FormInput = {
  type: "pr" | "offsite";
  title: string;
  owner: string;
  assigner: string;
  objective: string;
  audience: string;
  source: string;
  requestedDate: string;
  whyNow: string;
  contentTypes: string[];
  confirmed: boolean;
  priorityReason: string;
  projectDetails: string;
  startTime: string;
  endTime: string;
  travel: string;
};
export function getRequestFormIssue(
  input: FormInput,
  contentTypes = input.contentTypes,
): string | null {
  try {
    validateRequestSubmission(
      {
        type: input.type.toUpperCase(),
        title: input.title,
        requestedFor: input.requestedDate ? new Date(input.requestedDate) : undefined,
        sourceUrls: input.source
          .split(/\n+/)
          .map((value) => value.trim())
          .filter(Boolean),
        objective: input.objective,
        audience: input.audience,
        priorityReason: input.priorityReason,
        details: {
          projectOwner: input.owner,
          assigner: input.assigner,
          whyNow: input.whyNow,
          contentTypes: input.type === "pr" ? input.contentTypes : [],
          confirmed: input.confirmed,
          priorityReason: input.priorityReason,
          projectDetails: input.projectDetails,
          startTime: input.startTime,
          endTime: input.endTime,
          travel: input.travel,
        },
      },
      new Set(contentTypes),
    );
    return null;
  } catch (error) {
    if (error instanceof RequestSubmissionError) return error.message;
    throw error;
  }
}
export function getRequestFormErrorMessage(issue: string, language: "th" | "en"): string {
  if (language === "en") return issue;
  const messages: Record<string, string> = {
    "Title must contain 3 to 300 characters": "ชื่อโครงการต้องมี 3–300 ตัวอักษร",
    "A valid requested date is required": "กรุณาระบุวันที่ที่ต้องการให้ถูกต้อง",
    "At least one source URL is required":
      "กรุณาแนบลิงก์ข้อมูลต้นทางอย่างน้อยหนึ่งรายการ",
    "A source URL must be a valid HTTPS URL":
      "ลิงก์ข้อมูลต้นทางต้องเป็น HTTPS ที่ถูกต้อง",
    "Project owner is required": "กรุณาระบุเจ้าของโครงการ",
    "Assigner is required": "กรุณาระบุผู้มอบหมายงาน",
    "Source confirmation is required": "กรุณายืนยันความถูกต้องของข้อมูลต้นทาง",
    "Why-now is required": "กรุณาระบุเหตุผลที่ต้องสื่อสารในช่วงนี้",
    "Objective is required": "กรุณาระบุวัตถุประสงค์การสื่อสาร",
    "Audience is required": "กรุณาระบุกลุ่มเป้าหมาย",
    "Select valid content types from the current master data":
      "กรุณาเลือกประเภทเนื้อหาที่เปิดใช้งานอย่างน้อยหนึ่งรายการ",
    "Valid off-site start/end times and travel arrangement are required":
      "กรุณาระบุเวลาเริ่ม–สิ้นสุดและการเดินทางให้ถูกต้อง โดยเวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม",
  };
  return (
    messages[issue] ?? `กรุณาตรวจสอบข้อมูลให้ครบและไม่เกินความยาวที่กำหนด (${issue})`
  );
}
