import { describe, expect, it } from "vitest";
import { findContentByPath, getNavigationTree } from "./content-store";
import type { WpContentRecord } from "./types";

const records: WpContentRecord[] = [
  {
    id: "th-page-1",
    wpId: 1,
    language: "th",
    kind: "page",
    path: "/เกี่ยวกับ-สทร",
    sourceUrl: "https://www.rtrda.or.th/เกี่ยวกับ-สทร",
    title: "เกี่ยวกับ สทร.",
    excerpt: "",
    contentHtml: "<p>Thai</p>",
    modified: "2026-01-01T00:00:00",
    date: "2026-01-01T00:00:00",
    parentPath: null,
    categoryIds: [],
    featuredMediaId: null,
  },
  {
    id: "en-page-1",
    wpId: 1,
    language: "en",
    kind: "page",
    path: "/en/เกี่ยวกับ-สทร",
    sourceUrl: "https://www.rtrda.or.th/en/เกี่ยวกับ-สทร",
    title: "About RTRDA",
    excerpt: "",
    contentHtml: "<p>English</p>",
    modified: "2026-01-01T00:00:00",
    date: "2026-01-01T00:00:00",
    parentPath: null,
    categoryIds: [],
    featuredMediaId: null,
  },
];

describe("content store helpers", () => {
  it("finds records by decoded or encoded route paths", () => {
    expect(findContentByPath(records, "/เกี่ยวกับ-สทร")?.title).toBe(
      "เกี่ยวกับ สทร.",
    );
    expect(
      findContentByPath(records, "/%e0%b9%80%e0%b8%81%e0%b8%b5%e0%b9%88")?.title,
    ).toBeUndefined();
    expect(
      findContentByPath(
        records,
        "/en/%e0%b9%80%e0%b8%81%e0%b8%b5%e0%b9%88%e0%b8%a2%e0%b8%a7%e0%b8%81%e0%b8%b1%e0%b8%9a-%e0%b8%aa%e0%b8%97%e0%b8%a3",
      )?.title,
    ).toBe("About RTRDA");
  });

  it("builds top-level navigation for one language", () => {
    const nav = getNavigationTree(records, "en");

    expect(nav).toEqual([
      {
        label: "About RTRDA",
        href: "/en/เกี่ยวกับ-สทร",
        path: "/en/เกี่ยวกับ-สทร",
        external: false,
        children: [],
      },
    ]);
  });
});
