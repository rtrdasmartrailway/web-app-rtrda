import { describe, expect, it } from "vitest";
import { sanitizeContentHtml } from "./sanitize-content";

describe("sanitizeContentHtml", () => {
  it("removes scripts, event handlers, and javascript URLs", () => {
    const html = sanitizeContentHtml(
      '<div onclick="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">bad</a><img src="/ok.png" onerror="alert(1)"></div>',
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('src="/ok.png"');
  });

  it("preserves required local and approved iframe sources", () => {
    const html = sanitizeContentHtml(
      '<iframe src="/local-reader"></iframe><iframe src="https://www.youtube.com/embed/abc"></iframe><iframe src="https://www.google.com/maps/embed"></iframe>',
    );

    expect(html).toContain('src="/local-reader"');
    expect(html).toContain('src="https://www.youtube.com/embed/abc"');
    expect(html).toContain('src="https://www.google.com/maps/embed"');
  });

  it("drops unapproved remote iframe sources", () => {
    const html = sanitizeContentHtml(
      '<iframe src="https://attacker.example/embed"></iframe><p>safe</p>',
    );

    expect(html).not.toContain("attacker.example");
    expect(html).toContain("<p>safe</p>");
  });

  it("preserves legacy layout attributes required by imported content", () => {
    const html = sanitizeContentHtml(
      '<div class="legacy" data-id="42" style="color:#003471"><table><tr><td colspan="2">ok</td></tr></table></div>',
    );

    expect(html).toContain('class="legacy"');
    expect(html).toContain('data-id="42"');
    expect(html).toContain('style="color:#003471"');
    expect(html).toContain('colspan="2"');
  });
});
