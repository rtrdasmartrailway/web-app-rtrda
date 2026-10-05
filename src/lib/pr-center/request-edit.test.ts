import { describe, expect, it } from "vitest";
import { canEditOwnRequest } from "./request-edit";

describe("canEditOwnRequest", () => {
  it.each(["DRAFT", "SUBMITTED", "REJECTED"])(
    "allows the owner to edit %s requests",
    (status) => {
      expect(canEditOwnRequest({ requesterId: "owner-1", status }, "owner-1")).toBe(true);
    },
  );

  it.each(["APPROVED", "WITHDRAWN", "CANCELLED", "CLOSED"])(
    "does not allow edits to %s requests",
    (status) => {
      expect(canEditOwnRequest({ requesterId: "owner-1", status }, "owner-1")).toBe(
        false,
      );
    },
  );

  it("does not let another user edit the request", () => {
    expect(
      canEditOwnRequest({ requesterId: "owner-1", status: "SUBMITTED" }, "other-user"),
    ).toBe(false);
  });
});
