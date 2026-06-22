import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StickyFacebookButton } from "./sticky-facebook-button";

describe("StickyFacebookButton", () => {
  it("renders the Messenger link button on the homepage", () => {
    const html = renderToStaticMarkup(<StickyFacebookButton isHome />);

    expect(html).toContain("sticky-fb-btn");
    expect(html).toContain("https://m.me/100799302693049");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('aria-label="Facebook Messenger"');
    expect(html).toContain("sticky-fb-btn-icon");
    expect(html).toContain("sticky-fb-btn-ring");
  });

  it("renders nothing on inner pages", () => {
    const html = renderToStaticMarkup(<StickyFacebookButton isHome={false} />);

    expect(html).toBe("");
  });
});
