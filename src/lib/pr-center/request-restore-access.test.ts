import { describe, expect, it } from "vitest";
import { canRestoreRequestInUi } from "./request-restore-access";

describe("request restore affordance follows canonical grants and lifecycle", () => {
  const request = { departmentId: "department-a", status: "CANCELLED", version: 3 };
  it.each(["WITHDRAWN", "CANCELLED"])("permits scoped BORD on %s", (status) => {
    expect(
      canRestoreRequestInUi([{ role: "RTRDA_BORD", departmentId: "department-a" }], {
        ...request,
        status,
      }),
    ).toBe(true);
  });
  it.each(["RTRDA_BORD", "RTRDA_ADMIN"])("permits global eligible %s", (role) => {
    expect(canRestoreRequestInUi([{ role, departmentId: null }], request)).toBe(true);
  });
  it.each(["RTRDA_PR", "RTRDA_ALL_USER"])(
    "does not grant restore from global %s",
    (role) => {
      expect(canRestoreRequestInUi([{ role, departmentId: null }], request)).toBe(false);
    },
  );
  it("does not widen department BORD with an unrelated global grant", () => {
    expect(
      canRestoreRequestInUi(
        [
          { role: "RTRDA_BORD", departmentId: "department-b" },
          { role: "RTRDA_PR", departmentId: null },
        ],
        request,
      ),
    ).toBe(false);
  });
  it("unions eligible scopes independently", () => {
    expect(
      canRestoreRequestInUi(
        [
          { role: "RTRDA_BORD", departmentId: "department-b" },
          { role: "RTRDA_ADMIN", departmentId: "department-a" },
        ],
        request,
      ),
    ).toBe(true);
  });
  it.each(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CLOSED"])(
    "does not restore %s",
    (status) => {
      expect(
        canRestoreRequestInUi([{ role: "RTRDA_BORD", departmentId: null }], {
          ...request,
          status,
        }),
      ).toBe(false);
    },
  );
  it.each([undefined, 0, -1, 1.5, Number.NaN])(
    "fails closed for invalid version %s",
    (version) => {
      expect(
        canRestoreRequestInUi([{ role: "RTRDA_BORD", departmentId: null }], {
          ...request,
          version,
        }),
      ).toBe(false);
    },
  );
  it("fails closed without department metadata for a scoped grant", () => {
    expect(
      canRestoreRequestInUi([{ role: "RTRDA_BORD", departmentId: "department-a" }], {
        ...request,
        departmentId: undefined,
      }),
    ).toBe(false);
  });
  it("fails closed without grants", () =>
    expect(canRestoreRequestInUi(undefined, request)).toBe(false));
});
