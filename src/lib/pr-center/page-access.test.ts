import { describe, expect, it } from "vitest";
import { canOpenPrCenterPage, isPrCenterPageEnabled } from "./page-access";

describe("Requester navigation", () => {
  it.each([
    "home",
    "new-request",
    "my-requests",
    "calendar",
    "operations",
    "notifications",
    "help",
  ])("opens core page %s", (page) => {
    expect(canOpenPrCenterPage(page, ["RTRDA_ALL_USER"])).toBe(true);
  });
  it.each([
    "requests",
    "approvals",
    "library",
    "history",
    "directory",
    "settings",
    "system-data",
  ])("denies elevated page %s even with optional pages enabled", (page) => {
    expect(
      canOpenPrCenterPage(page, ["RTRDA_ALL_USER"], "ideas,message-house,library"),
    ).toBe(false);
  });
  it.each(["ideas", "message-house"])("requires feature flag for %s", (page) => {
    expect(canOpenPrCenterPage(page, ["RTRDA_ALL_USER"])).toBe(false);
    expect(canOpenPrCenterPage(page, ["RTRDA_ALL_USER"], " ideas, message-house ")).toBe(
      true,
    );
  });
  it("keeps disabled/unknown pages closed and respects role unions", () => {
    expect(isPrCenterPageEnabled("system-data")).toBe(true);
    expect(canOpenPrCenterPage("system-data", ["RTRDA_PR"])).toBe(false);
    expect(canOpenPrCenterPage("executive", ["RTRDA_BORD"])).toBe(false);
    expect(canOpenPrCenterPage("system-data", ["RTRDA_ADMIN"])).toBe(true);
    expect(canOpenPrCenterPage("executive", ["RTRDA_ADMIN"])).toBe(true);
    expect(canOpenPrCenterPage("help", [])).toBe(false);
    expect(canOpenPrCenterPage("requests", ["RTRDA_ALL_USER", "RTRDA_PR"])).toBe(true);
  });
});
