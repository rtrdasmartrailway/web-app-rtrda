import { describe, expect, it } from "vitest";
import { grantCoversDepartment } from "./client-grant-scope";

describe("task UI scope uses eligible complete grants", () => {
  const grants = [
    { role: "RTRDA_PR", departmentId: "a" },
    { role: "RTRDA_ALL_USER", departmentId: null },
    { role: "RTRDA_ADMIN", departmentId: "b" },
  ];
  it.each([
    { roles: ["RTRDA_PR"], department: "a", allowed: true },
    { roles: ["RTRDA_PR"], department: "b", allowed: false },
    { roles: ["RTRDA_PR"], department: undefined, allowed: false },
    { roles: ["RTRDA_PR"], department: null, allowed: false },
    { roles: ["RTRDA_PR", "RTRDA_ADMIN"], department: "b", allowed: true },
    { roles: ["RTRDA_PR", "RTRDA_ADMIN"], department: "c", allowed: false },
  ])("$roles on $department", ({ roles, department, allowed }) => {
    expect(grantCoversDepartment(grants, roles, department)).toBe(allowed);
  });
  it("allows only the eligible global role and fails closed on missing grants", () => {
    expect(
      grantCoversDepartment(
        [{ role: "RTRDA_PR", departmentId: null }],
        ["RTRDA_PR"],
        undefined,
      ),
    ).toBe(true);
    expect(grantCoversDepartment(undefined, ["RTRDA_PR"], "a")).toBe(false);
  });
});
