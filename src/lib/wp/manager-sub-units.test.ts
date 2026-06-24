import { describe, expect, it } from "vitest";
import {
  getManagerSubUnits,
  MANAGER_SUB_UNITS_BY_ROLE,
  MANAGER_SUB_UNITS_BUTTON_LABEL,
  MANAGER_SUB_UNITS_HEADING,
} from "./manager-sub-units";

describe("manager sub-units config", () => {
  it("exposes a Thai heading and button label", () => {
    expect(MANAGER_SUB_UNITS_HEADING).toBe("หน่วยงานภายใต้การกำกับดูแล");
    expect(MANAGER_SUB_UNITS_BUTTON_LABEL).toBe("เพิ่มเติม");
  });

  it("lists sub-units for every general-manager role", () => {
    expect(Object.keys(MANAGER_SUB_UNITS_BY_ROLE)).toEqual([
      "ผู้จัดการกลุ่มวิจัยและมาตรฐาน",
      "ผู้จัดการกลุ่มพัฒนาผู้ประกอบการและธุรกิจใหม่",
      "ผู้จัดการกลุ่มพัฒนาดิจิทัลระบบราง",
      "ผู้จัดการกลุ่มกลยุทธ์และสื่อสารองค์กร",
      "ผู้จัดการกลุ่มบริหารภายใน",
    ]);
  });

  it("returns the board-authored copy for known roles", () => {
    expect(getManagerSubUnits("ผู้จัดการกลุ่มบริหารภายใน")).toEqual([
      "งานบัญชีและการเงิน",
      "งานกฎหมาย",
      "งานธุรการและสารบรรณ",
      "งานบุคคล",
      "งานธรรมาภิบาล ความเสี่ยงและควบคุมภายใน",
    ]);
    expect(getManagerSubUnits("ผู้จัดการกลุ่มพัฒนาดิจิทัลระบบราง")).toEqual([
      "งาน Smart Railway Project",
      "งาน Network & Performance",
    ]);
  });

  it("returns null for unknown roles", () => {
    expect(getManagerSubUnits("ผู้อำนวยการ")).toBeNull();
    expect(getManagerSubUnits("")).toBeNull();
  });
});
