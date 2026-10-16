import { describe, expect, it } from "vitest";
import { directoryUserAuthority } from "./directory-access";

const user = { active: true, department: { id: "a" } };
describe("directory UI uses each grant's own scope", () => {
  it.each([
    {
      grants: [{ role: "RTRDA_PR", departmentId: "a" }],
      result: { administer: false, grantBoard: true, canGrant: true },
    },
    {
      grants: [
        { role: "RTRDA_PR", departmentId: "b" },
        { role: "RTRDA_ALL_USER", departmentId: null },
      ],
      result: { administer: false, grantBoard: false, canGrant: false },
    },
    {
      grants: [
        { role: "RTRDA_ADMIN", departmentId: "b" },
        { role: "RTRDA_PR", departmentId: "a" },
      ],
      result: { administer: false, grantBoard: true, canGrant: true },
    },
    {
      grants: [
        { role: "RTRDA_ADMIN", departmentId: "a" },
        { role: "RTRDA_PR", departmentId: "b" },
      ],
      result: { administer: true, grantBoard: false, canGrant: true },
    },
    {
      grants: [{ role: "RTRDA_ADMIN", departmentId: null }],
      result: { administer: true, grantBoard: false, canGrant: true },
    },
    {
      grants: [{ role: "RTRDA_PR", departmentId: null }],
      result: { administer: false, grantBoard: true, canGrant: true },
    },
    {
      grants: [{ role: "RTRDA_BORD", departmentId: null }],
      result: { administer: false, grantBoard: false, canGrant: false },
    },
  ])("evaluates $grants", ({ grants, result }) => {
    expect(
      directoryUserAuthority({ role: "RTRDA_PR", roleGrants: grants }, user),
    ).toEqual(result);
  });
  it.each([
    { active: false, department: { id: "a" } },
    { active: true, department: null },
  ])("PR cannot grant BORD to an inactive or department-less target", (target) => {
    expect(
      directoryUserAuthority(
        { role: "RTRDA_PR", roleGrants: [{ role: "RTRDA_PR", departmentId: null }] },
        target,
      ).canGrant,
    ).toBe(false);
  });
  it("never derives grant scope from a display role", () => {
    expect(directoryUserAuthority({ role: "RTRDA_ADMIN" }, user).canGrant).toBe(false);
  });
});
