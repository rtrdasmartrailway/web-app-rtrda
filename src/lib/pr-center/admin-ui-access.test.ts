import { describe, expect, it } from "vitest";
import { canAdminEditRequest, canEditOwnRequest } from "./request-edit";
import { canOpenPrCenterPage } from "./page-access";

const request = { requesterId: "owner", departmentId: "a", status: "DRAFT" };
const scoped = [{ role: "RTRDA_ADMIN", departmentId: "a" }];

describe("administrator UI authority without workflow impersonation", () => {
  for (const status of ["DRAFT", "SUBMITTED", "REJECTED", "WITHDRAWN"]) {
    it(`allows scoped nonowner administrator editing ${status}`, () => {
      expect(canAdminEditRequest({ ...request, status }, scoped)).toBe(true);
      expect(canEditOwnRequest({ ...request, status }, "administrator")).toBe(false);
    });
  }
  for (const status of ["APPROVED", "CANCELLED", "COMPLETED", "UNKNOWN", ""]) {
    it(`does not offer administrator editing ${status || "missing status"}`, () => {
      expect(canAdminEditRequest({ ...request, status }, scoped)).toBe(false);
    });
  }
  it("denies unrelated global grants and unknown/outside department", () => {
    const mixed = [...scoped, { role: "RTRDA_PR", departmentId: null }];
    expect(canAdminEditRequest({ ...request, departmentId: "b" }, mixed)).toBe(false);
    expect(canAdminEditRequest({ ...request, departmentId: undefined }, mixed)).toBe(
      false,
    );
    expect(
      canAdminEditRequest(request, [{ role: "RTRDA_BORD", departmentId: null }]),
    ).toBe(false);
    expect(canAdminEditRequest(request, undefined)).toBe(false);
  });
  it("allows organization ADMIN, preserving requester permissions separately", () => {
    expect(
      canAdminEditRequest(request, [{ role: "RTRDA_ADMIN", departmentId: null }]),
    ).toBe(true);
    expect(canEditOwnRequest(request, "owner")).toBe(true);
  });
  for (const page of ["executive", "system-data"]) {
    it(`makes ${page} reachable for ADMIN, not ordinary elevated roles`, () => {
      expect(canOpenPrCenterPage(page, ["RTRDA_ADMIN"])).toBe(true);
      expect(
        canOpenPrCenterPage(page, ["RTRDA_PR", "RTRDA_BORD", "RTRDA_ALL_USER"]),
      ).toBe(false);
    });
  }
});
