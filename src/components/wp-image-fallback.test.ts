import { describe, expect, it } from "vitest";
import { isLocalAssetPath, rewriteSrcsetToLocal, toLocalAssetPath } from "./wp-image-fallback";

describe("local-only WordPress asset handling", () => {
  it("keeps local wp-content paths local", () => {
    expect(toLocalAssetPath("/wp-content/uploads/2023/02/logo.png")).toBe(
      "/wp-content/uploads/2023/02/logo.png",
    );
  });

  it("keeps local sdc-download paths local", () => {
    expect(toLocalAssetPath("/sdc-downloads/file.pdf")).toBe("/sdc-downloads/file.pdf");
  });

  it("rewrites legacy WordPress asset URLs back to local paths", () => {
    expect(toLocalAssetPath("https://www.rtrda.or.th/wp-content/uploads/a.jpg?v=2")).toBe(
      "/wp-content/uploads/a.jpg?v=2",
    );
    expect(toLocalAssetPath("https://rtrda.or.th/sdc-downloads/doc.pdf")).toBe(
      "/sdc-downloads/doc.pdf",
    );
  });

  it("does not rewrite unrelated external URLs", () => {
    expect(toLocalAssetPath("https://cdn.example.com/a.jpg")).toBe("https://cdn.example.com/a.jpg");
  });

  it("rewrites srcset legacy candidates to local paths", () => {
    expect(
      rewriteSrcsetToLocal(
        "https://www.rtrda.or.th/wp-content/uploads/a.jpg 300w, /wp-content/uploads/a-large.jpg 900w",
      ),
    ).toBe("/wp-content/uploads/a.jpg 300w, /wp-content/uploads/a-large.jpg 900w");
  });

  it("recognises only local migrated asset prefixes", () => {
    expect(isLocalAssetPath("/wp-content/uploads/a.jpg")).toBe(true);
    expect(isLocalAssetPath("/sdc-downloads/a.pdf")).toBe(true);
    expect(isLocalAssetPath("/api/health")).toBe(false);
  });
});
