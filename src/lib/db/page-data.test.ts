import { describe, expect, it } from "vitest";
import type { PresentationNavItem } from "@/lib/wp/presentation";
import type { WpContentRecord } from "@/lib/wp/types";
import {
  buildSidebarItems,
  deriveCounterpartCandidate,
  isNewsHubPath,
  sortCategoryNewsByDateDesc,
  toCards,
} from "./page-data";

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

describe("isNewsHubPath", () => {
  it("matches the Thai and English news hub parent pages only", () => {
    expect(isNewsHubPath("/ข่าวสาร-กิจกรรม")).toBe(true);
    expect(isNewsHubPath("/en/ข่าวสาร-กิจกรรม")).toBe(true);
    expect(isNewsHubPath("/category/ข่าวและกิจกรรม")).toBe(false);
    expect(isNewsHubPath("/ข่าวสาร-กิจกรรม/ข่าว-กิจกรรม")).toBe(false);
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
    expect(items).toEqual([
      {
        label: "ลูก",
        href: "/parent/me/ลูก",
        path: "/parent/me/ลูก",
        external: false,
        active: false,
      },
    ]);
  });

  it("falls back to siblings and keeps the current page active when useful", () => {
    // current is included in the siblings list (real DB query returns it
    // when fetching by parentPath), so keep it when there are other entries
    // to make the active sidebar state visible.
    const items = buildSidebarItems(current, [], [sibling, current]);
    expect(items).toEqual([
      {
        label: "อื่น",
        href: "/parent/อื่น",
        path: "/parent/อื่น",
        external: false,
        active: false,
      },
      {
        label: "หน้า",
        href: "/parent/me",
        path: "/parent/me",
        external: false,
        active: true,
      },
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
      {
        label: "Second in DB",
        href: "/parent/อื่น",
        path: "/parent/อื่น",
        external: false,
        active: false,
      },
      {
        label: "Current",
        href: "/parent/me",
        path: "/parent/me",
        external: false,
        active: true,
      },
    ]);
  });

  it("flattens nested navbar entries in menu order", () => {
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
      {
        label: "Category",
        href: "/news/category",
        path: "/news/category",
        external: false,
        active: false,
      },
      {
        label: "Apply",
        href: "/news/jobs/apply",
        path: "/news/jobs/apply",
        external: false,
        active: true,
      },
      {
        label: "External",
        href: "https://example.com",
        path: null,
        external: true,
        active: false,
      },
    ]);
  });

  it("keeps external navbar entries in sidebars", () => {
    const navItems = [
      navItem({
        label: "ติดต่อเรา",
        active: true,
        children: [
          navItem({
            label: "ช่องทางการติดต่อ",
            path: "/ติดต่อเรา/ช่องทางการติดต่อ",
            href: "/ติดต่อเรา/ช่องทางการติดต่อ",
          }),
          navItem({
            label: "ช่องทางแจ้งเรื่องร้องเรียนฯ สำนักงาน ป.ป.ช.",
            href: "https://www.nacc.go.th/allcomplaint?csrt=930900954617268973",
            external: true,
          }),
        ],
      }),
    ];
    const contactPage = record({
      path: "/ติดต่อเรา/ช่องทางการติดต่อ",
      parentPath: "/ติดต่อเรา",
    });

    expect(buildSidebarItems(contactPage, [], [contactPage], navItems)).toEqual([
      {
        label: "ช่องทางการติดต่อ",
        href: "/ติดต่อเรา/ช่องทางการติดต่อ",
        path: "/ติดต่อเรา/ช่องทางการติดต่อ",
        external: false,
        active: true,
      },
      {
        label: "ช่องทางแจ้งเรื่องร้องเรียนฯ สำนักงาน ป.ป.ช.",
        href: "https://www.nacc.go.th/allcomplaint?csrt=930900954617268973",
        path: null,
        external: true,
        active: false,
      },
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

describe("sortCategoryNewsByDateDesc", () => {
  it("orders records by date descending (newest first)", () => {
    const records = [
      record({ id: "old", date: "2026-02-24T00:00:00" }),
      record({ id: "newest", date: "2026-06-09T02:43:33" }),
      record({ id: "middle", date: "2026-05-14T16:57:50" }),
    ];

    expect(sortCategoryNewsByDateDesc(records).map((entry) => entry.id)).toEqual([
      "newest",
      "middle",
      "old",
    ]);
  });

  it("does not mutate the input array", () => {
    const records = [
      record({ id: "a", date: "2026-02-24T00:00:00" }),
      record({ id: "b", date: "2026-06-09T02:43:33" }),
    ];
    const before = records.map((entry) => entry.id);

    sortCategoryNewsByDateDesc(records);

    expect(records.map((entry) => entry.id)).toEqual(before);
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
