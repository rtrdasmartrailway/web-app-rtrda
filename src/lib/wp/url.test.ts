import { describe, expect, it } from "vitest";
import {
  getRtrdaPathFromUrl,
  isRtrdaInternalUrl,
  normalizeRoutePath,
  rewriteRtrdaUrl,
} from "./url";

describe("RTRDA URL helpers", () => {
  it("normalizes live Thai and English WordPress URLs to same-site paths", () => {
    expect(
      getRtrdaPathFromUrl(
        "https://www.rtrda.or.th/%e0%b8%82%e0%b9%88%e0%b8%b2%e0%b8%a7/",
      ),
    ).toBe("/ข่าว");

    expect(
      getRtrdaPathFromUrl(
        "https://www.rtrda.or.th/en/%e0%b8%82%e0%b9%88%e0%b8%b2%e0%b8%a7/?utm_source=x#top",
      ),
    ).toBe("/en/ข่าว");
  });

  it("keeps external URLs external and rewrites internal RTRDA URLs to relative paths", () => {
    expect(isRtrdaInternalUrl("https://www.rtrda.or.th/wp-content/a.pdf")).toBe(true);
    expect(isRtrdaInternalUrl("https://forms.gle/example")).toBe(false);
    expect(rewriteRtrdaUrl("https://www.rtrda.or.th/en/contact/")).toBe("/en/contact");
    expect(
      rewriteRtrdaUrl("http://119.63.69.36/wp-content/uploads/2024/11/ประกาศผู้ชนะ.pdf"),
    ).toBe("/wp-content/uploads/2024/11/ประกาศผู้ชนะ.pdf");
    expect(rewriteRtrdaUrl("https://forms.gle/example")).toBe(
      "https://forms.gle/example",
    );
  });

  it("normalizes slashes without dropping the root route", () => {
    expect(normalizeRoutePath("")).toBe("/");
    expect(normalizeRoutePath("/")).toBe("/");
    expect(normalizeRoutePath("//en///ข่าว///")).toBe("/en/ข่าว");
  });
});
