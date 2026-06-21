import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  LANDING_POPUP_CONTENT,
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
  it("renders the old WordPress image-only popup when opened", () => {
    const html = renderToStaticMarkup(<LandingPopup path="/" forceOpen />);

    expect(html).toContain('role="dialog"');
    expect(html).toContain("landing-popup-image");
    expect(html).toContain(encodeURIComponent(LANDING_POPUP_CONTENT.src));
    expect(html).toContain(LANDING_POPUP_CONTENT.alt);
    expect(html).toContain('width="1024"');
    expect(html).toContain('height="1024"');
    expect(html).not.toContain("ดร. โชติชัย เจริญงาม");
    expect(html).not.toContain("การศึกษา");
  });

  it("renders only a hidden mount point before client hydration opens it", () => {
    const html = renderToStaticMarkup(<LandingPopup path="/" />);

    expect(html).toContain("data-landing-popup-root");
    expect(html).toContain("hidden");
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain(LANDING_POPUP_CONTENT.src);
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

  it("ignores the legacy biography popup dismissal key", () => {
    const storage = new MemoryStorage();

    storage.setItem("rtrda-landing-popup-dismissed", "1");

    expect(LANDING_POPUP_SESSION_KEY).not.toBe("rtrda-landing-popup-dismissed");
    expect(shouldShowLandingPopup(storage)).toBe(true);
  });
});
