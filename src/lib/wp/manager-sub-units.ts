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
  ผู้จัดการกลุ่มบริหารภายใน: [
    "งานบัญชีและการเงิน",
    "งานกฎหมาย",
    "งานธุรการและสารบรรณ",
    "งานบุคคล",
    "งานธรรมาภิบาล ความเสี่ยงและควบคุมภายใน",
  ],
} as const;

export function getManagerSubUnits(role: string): readonly string[] | null {
  return MANAGER_SUB_UNITS_BY_ROLE[role] ?? null;
}
