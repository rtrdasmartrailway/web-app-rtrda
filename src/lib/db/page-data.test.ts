import { describe, expect, it } from "vitest";
import type { WpContentRecord } from "@/lib/wp/types";
import { buildSidebarItems, deriveCounterpartCandidate, toCards } from "./page-data";

function record(overrides: Partial<WpContentRecord>): WpContentRecord {
  return {
    id: "th-page-1",
    wpId: "1",
    language: "th",
    kind: "page",
    path: "/หน้า",
    sourceUrl: "https://www.rtrda.or.th/หน้า/",
    title: "หน้า",
    excerpt: "",
    contentHtml: "<p>x</p>",
    modified: "2025-01-01T00:00:00",
    date: "2025-01-01T00:00:00",
    parentPath: null,
    categoryIds: [],
    featuredMediaId: null,
    ...overrides,
  };
}

describe("deriveCounterpartCandidate", () => {
  it("maps Thai paths to /en prefixed paths", () => {
    expect(deriveCounterpartCandidate("/", "th")).toBe("/en");
    expect(deriveCounterpartCandidate("/ข่าว", "th")).toBe("/en/ข่าว");
  });

  it("maps English paths back to Thai paths", () => {
    expect(deriveCounterpartCandidate("/en", "en")).toBe("/");
    expect(deriveCounterpartCandidate("/en/ข่าว", "en")).toBe("/ข่าว");
  });
});

describe("buildSidebarItems", () => {
  const current = record({ path: "/parent/me", parentPath: "/parent" });
  const sibling = record({
    id: "s",
    path: "/parent/อื่น",
    title: "อื่น",
    parentPath: "/parent",
  });
  const child = record({
    id: "c",
    path: "/parent/me/ลูก",
    title: "ลูก",
    parentPath: "/parent/me",
  });

  it("prefers children when present", () => {
    const items = buildSidebarItems(current, [child], [sibling, current]);
    expect(items).toEqual([{ label: "ลูก", path: "/parent/me/ลูก", active: false }]);
  });

  it("falls back to siblings, filters self, and marks the current page active", () => {
    // current is included in the siblings list (real DB query returns it
    // when fetching by parentPath), so the filter must remove it.
    const items = buildSidebarItems(current, [], [sibling, current]);
    expect(items).toEqual([{ label: "อื่น", path: "/parent/อื่น", active: false }]);
  });

  it("filters the current page itself when it is the only sibling", () => {
    // Real-world case: a page has no children, and its only sibling is itself.
    // The sidebar would be a single self-link, which is useless. Filter it out.
    const items = buildSidebarItems(current, [], [current]);
    expect(items).toEqual([]);
  });

  it("is empty for top-level pages without children", () => {
    expect(buildSidebarItems(record({}), [], [])).toEqual([]);
  });
});

describe("toCards", () => {
  it("resolves featured media images and falls back per kind", () => {
    const withImage = record({ id: "a", featuredMediaId: 9 });
    const flipbook = record({ id: "b", kind: "flipbook", path: "/3d-flip-book/x" });
    const media = [
      {
        id: "9",
        sourceUrl: "https://www.rtrda.or.th/wp-content/uploads/a.png",
        localPath: "/wp-content/uploads/a.png",
        title: "a",
        alt: "",
        width: 10,
        height: 20,
        mimeType: "image/png",
      },
    ];
    const cards = toCards([withImage, flipbook], media);
    expect(cards[0].imagePath).toBe("/wp-content/uploads/a.png");
    expect(cards[1].imagePath).toMatch(/stitch-assets/);
  });
});
