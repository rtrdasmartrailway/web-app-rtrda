import { describe, expect, it } from "vitest";
import { temporaryTestAccessForEmail } from "./email-only-auth";

describe("temporaryTestAccessForEmail", () => {
  it("grants Panissa PR Operations access", () => {
    expect(temporaryTestAccessForEmail("Panissa.t@rtrda.or.th")).toMatchObject({
      departmentCode: "PR",
      role: "PR_OPERATIONS",
    });
  });

  it("retains Nattapol's scoped administrator access", () => {
    expect(temporaryTestAccessForEmail("nattapol.y@rtrda.or.th")).toMatchObject({
      departmentCode: "ADMIN",
      role: "SCOPED_ADMINISTRATOR",
    });
  });

  it("rejects unconfigured addresses", () => {
    expect(temporaryTestAccessForEmail("not-authorized@rtrda.or.th")).toBeNull();
  });
});
