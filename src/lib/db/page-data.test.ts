import { describe, expect, it } from "vitest";
import type { PresentationNavItem } from "@/lib/wp/presentation";
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

function navItem(overrides: Partial<PresentationNavItem>): PresentationNavItem {
  return {
    label: "Nav item",
    href: "#",
    path: null,
    external: false,
    active: false,
    children: [],
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

  it("falls back to siblings and keeps the current page active when useful", () => {
    // current is included in the siblings list (real DB query returns it
    // when fetching by parentPath), so keep it when there are other entries
    // to make the active sidebar state visible.
    const items = buildSidebarItems(current, [], [sibling, current]);
    expect(items).toEqual([
      { label: "อื่น", path: "/parent/อื่น", active: false },
      { label: "หน้า", path: "/parent/me", active: true },
    ]);
  });

  it("uses active navbar children before fallback records", () => {
    const navItems = [
      navItem({
        label: "Parent",
        active: true,
        children: [
          navItem({ label: "Second in DB", path: "/parent/อื่น", href: "/parent/อื่น" }),
          navItem({ label: "Current", path: "/parent/me", href: "/parent/me" }),
        ],
      }),
    ];

    expect(buildSidebarItems(current, [child], [current, sibling], navItems)).toEqual([
      { label: "Second in DB", path: "/parent/อื่น", active: false },
      { label: "Current", path: "/parent/me", active: true },
    ]);
  });

  it("flattens internal nested navbar entries in menu order", () => {
    const navItems = [
      navItem({
        label: "News",
        children: [
          navItem({ label: "Category", path: "/news/category", href: "/news/category" }),
          navItem({
            label: "Jobs",
            active: true,
            children: [
              navItem({
                label: "Apply",
                path: "/news/jobs/apply",
                href: "/news/jobs/apply",
              }),
            ],
          }),
          navItem({ label: "External", href: "https://example.com", external: true }),
        ],
      }),
    ];
    const nestedCurrent = record({ path: "/news/jobs/apply", parentPath: "/news/jobs" });

    expect(buildSidebarItems(nestedCurrent, [], [nestedCurrent], navItems)).toEqual([
      { label: "Category", path: "/news/category", active: false },
      { label: "Apply", path: "/news/jobs/apply", active: true },
    ]);
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
