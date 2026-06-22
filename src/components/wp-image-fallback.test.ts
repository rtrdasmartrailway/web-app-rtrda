import { describe, expect, it } from "vitest";
import {
  LEGACY_ORIGIN,
  addCacheBuster,
  getLocalPath,
  isLocalContentPath,
  toLegacyUrl,
} from "./wp-image-fallback";

describe("isLocalContentPath", () => {
  it("recognises /wp-content/uploads/ paths", () => {
    expect(
      isLocalContentPath("/wp-content/uploads/2026/06/ita-5jun69-233161-1024x682.jpg"),
    ).toBe(true);
  });

  it("recognises /wp-content/ paths", () => {
    expect(isLocalContentPath("/wp-content/something/file.png")).toBe(true);
  });

  it("rejects absolute legacy URLs", () => {
    expect(isLocalContentPath("https://www.rtrda.or.th/wp-content/uploads/a.jpg")).toBe(
      false,
    );
  });

  it("rejects unrelated URLs", () => {
    expect(isLocalContentPath("https://cdn.example.com/pic.jpg")).toBe(false);
  });
});

describe("toLegacyUrl", () => {
  it("prepends the legacy origin", () => {
    expect(toLegacyUrl("/wp-content/uploads/a.jpg")).toBe(
      `${LEGACY_ORIGIN}/wp-content/uploads/a.jpg`,
    );
  });
});

describe("addCacheBuster", () => {
  it("adds ?v=2 to a clean URL", () => {
    expect(addCacheBuster("https://www.rtrda.or.th/a.jpg")).toBe(
      "https://www.rtrda.or.th/a.jpg?v=2",
    );
  });

  it("adds &v=2 when the URL already has a query string", () => {
    expect(addCacheBuster("https://www.rtrda.or.th/a.jpg?w=1024")).toBe(
      "https://www.rtrda.or.th/a.jpg?w=1024&v=2",
    );
  });
});

describe("getLocalPath", () => {
  it("returns relative paths stripped of query strings", () => {
    expect(getLocalPath("/wp-content/uploads/a.jpg?w=1024")).toBe(
      "/wp-content/uploads/a.jpg",
    );
  });

  it("extracts the pathname from legacy rtrda URLs", () => {
    expect(getLocalPath("https://www.rtrda.or.th/wp-content/uploads/2026/06/b.jpg")).toBe(
      "/wp-content/uploads/2026/06/b.jpg",
    );
  });

  it("extracts the pathname from non-www rtrda URLs", () => {
    expect(getLocalPath("https://rtrda.or.th/wp-content/uploads/c.jpg")).toBe(
      "/wp-content/uploads/c.jpg",
    );
  });

  it("returns null for unrelated external URLs", () => {
    expect(getLocalPath("https://cdn.example.com/pic.jpg")).toBeNull();
  });
});
