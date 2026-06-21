import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  LANDING_POPUP_SESSION_KEY,
  LandingPopup,
  isPublicLandingPopupPath,
  rememberLandingPopupDismissed,
  shouldShowLandingPopup,
} from "./landing-popup";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("LandingPopup", () => {
  it("renders the old WordPress popup biography when opened", () => {
    const html = renderToStaticMarkup(<LandingPopup path="/" forceOpen />);

    expect(html).toContain('role="dialog"');
    expect(html).toContain("ดร. โชติชัย เจริญงาม");
    expect(html).toContain("การศึกษา");
    expect(html).toContain("ประสบการณ์การทำงาน");
    expect(html).toContain("ประวัติด้านกรรมการ/อนุกรรมการ/ที่ปรึกษา");
    expect(html).toContain("University of Texas at Austin");
  });

  it("renders only a hidden mount point before client hydration opens it", () => {
    const html = renderToStaticMarkup(<LandingPopup path="/" />);

    expect(html).toContain("data-landing-popup-root");
    expect(html).toContain("hidden");
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("ดร. โชติชัย เจริญงาม");
  });

  it("does not render on intranet routes", () => {
    expect(isPublicLandingPopupPath("/rtrdaintranet")).toBe(false);
    expect(isPublicLandingPopupPath("/rtrdaintranet/blog")).toBe(false);
    expect(renderToStaticMarkup(<LandingPopup path="/rtrdaintranet" forceOpen />)).toBe(
      "",
    );
  });
});

describe("landing popup session storage", () => {
  it("shows until dismissed for the current session", () => {
    const storage = new MemoryStorage();

    expect(shouldShowLandingPopup(storage)).toBe(true);
    rememberLandingPopupDismissed(storage);
    expect(storage.getItem(LANDING_POPUP_SESSION_KEY)).toBe("1");
    expect(shouldShowLandingPopup(storage)).toBe(false);
  });
});
