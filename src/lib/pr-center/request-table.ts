const REQUEST_STATUS_PRIORITY = [
  "rejected",
  "revision_required",
  "waiting_for_information",
  "management_approval",
  "pr_editorial_review",
  "technical_review",
  "source_fact_check",
  "in_production",
  "communication_planning",
  "draft",
  "approved",
  "scheduled",
  "published",
  "closed",
  "cancelled",
] as const;

export type RequestTableStatus = (typeof REQUEST_STATUS_PRIORITY)[number];

const REQUEST_STATUS_LABELS_TH: Record<RequestTableStatus, string> = {
  draft: "ร่าง",
  waiting_for_information: "รอข้อมูล",
  communication_planning: "วางแผนการสื่อสาร",
  in_production: "กำลังผลิต",
  source_fact_check: "ตรวจสอบข้อมูลต้นทาง",
  technical_review: "ตรวจสอบทางเทคนิค",
  pr_editorial_review: "PR Editorial Review",
  management_approval: "รอผู้บริหารอนุมัติ",
  revision_required: "ต้องแก้ไข",
  approved: "อนุมัติครบแล้ว",
  scheduled: "กำหนดเผยแพร่",
  published: "เผยแพร่แล้ว",
  closed: "ปิดงาน",
  rejected: "ปฏิเสธ",
  cancelled: "ยกเลิก",
};

export function requestTableStatusLabel(
  status: RequestTableStatus,
  language: "th" | "en",
) {
  if (language === "th") return REQUEST_STATUS_LABELS_TH[status];
  const labels: Record<RequestTableStatus, string> = {
    draft: "Draft",
    waiting_for_information: "Waiting for information",
    communication_planning: "Communication planning",
    in_production: "In production",
    source_fact_check: "Source fact check",
    technical_review: "Technical review",
    pr_editorial_review: "PR editorial review",
    management_approval: "Awaiting approval",
    revision_required: "Revision required",
    approved: "Approved",
    scheduled: "Scheduled",
    published: "Published",
    closed: "Closed",
    rejected: "Rejected",
    cancelled: "Cancelled",
  };
  return labels[status];
}

export type RequestTableTask = {
  contentType: string;
  status: string;
};

export function summarizeRequestTableTasks(tasks: RequestTableTask[]) {
  const contentTypes = [
    ...new Set(tasks.map((task) => task.contentType.trim()).filter(Boolean)),
  ].slice(0, 3);
  const statuses = tasks.map((task) => task.status);

  let status: RequestTableStatus = "draft";
  if (statuses.length > 0) {
    if (statuses.every((item) => item === "closed")) status = "closed";
    else if (statuses.every((item) => ["published", "closed"].includes(item)))
      status = "published";
    else
      status = REQUEST_STATUS_PRIORITY.find((item) => statuses.includes(item)) ?? "draft";
  }

  return { count: tasks.length, contentTypes, status };
}
