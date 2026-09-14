export const MANAGER_SUB_UNITS_HEADING = "หน่วยงานภายใต้การกำกับดูแล";
export const MANAGER_SUB_UNITS_BUTTON_LABEL = "เพิ่มเติม";

/**
 * Sub-units under each general-manager group. Keyed by the exact manager role
 * string used in the executive chart so the React component can stay generic.
 *
 * This is static board-authored copy, not parsed from the WordPress snapshot;
 * the snapshot does not encode sub-units.
 */
export const MANAGER_SUB_UNITS_BY_ROLE: Readonly<Record<string, readonly string[]>> = {
  ผู้จัดการกลุ่มวิจัยและมาตรฐาน: ["ทีมวิจัย", "ทีมมาตรฐาน"],
  ผู้จัดการกลุ่มพัฒนาผู้ประกอบการและธุรกิจใหม่: [
    "ทีมพัฒนาผู้ประกอบการ",
    "งานพัฒนาธุรกิจใหม่",
  ],
  ผู้จัดการกลุ่มพัฒนาดิจิทัลระบบราง: [
    "งาน Smart Railway Project",
    "งาน Network & Performance",
  ],
  ผู้จัดการกลุ่มกลยุทธ์และสื่อสารองค์กร: [
    "งานแผนและงบประมาณ",
    "งานเลขานุการคณะกรรมการและบริหารผู้มีส่วนได้ส่วนเสีย",
    "งานโครงการพิเศษภายใต้กลุ่มงาน",
    "งานพัสดุ",
    "งานประเมินผลองค์กร",
  ],
  "ผู้จัดการกลุ่มบริหารภายใน (รักษาการแทน)": [
    "งานบัญชีและการเงิน",
    "งานกฎหมาย",
    "งานธุรการและสารบรรณ",
    "งานบุคคล",
    "งานธรรมาภิบาล ความเสี่ยงและควบคุมภายใน",
  ],
  "Research and Standards Group Manager": ["Research Team", "Standards Team"],
  "New Entrepreneurs and Business Development Group Manager": [
    "Entrepreneur Development Team",
    "New Business Development",
  ],
  "Rail Systems Digital Development Group Manager": [
    "Smart Railway Project",
    "Network & Performance",
  ],
  "Strategy and Corporate Communications Group Manager": [
    "Planning and Budgeting",
    "Board Secretariat and Stakeholder Management",
    "Special Projects",
    "Procurement",
    "Organizational Performance Evaluation",
  ],
  "Internal Administration Group Manager (Acting)": [
    "Accounting and Finance",
    "Legal Affairs",
    "Administration and Records",
    "Human Resources",
    "Governance, Risk and Internal Control",
  ],
} as const;

export function getManagerSubUnits(role: string): readonly string[] | null {
  return MANAGER_SUB_UNITS_BY_ROLE[role] ?? null;
}
