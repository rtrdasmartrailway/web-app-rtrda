import { describe, expect, it } from "vitest";
import { manifestToRows } from "./seed-db-helpers.mjs";

const manifest = {
  generatedAt: "2026-06-11T07:52:02.737Z",
  source: "https://www.rtrda.or.th",
  counts: { pages: 1, posts: 1, media: 1, categories: 1, flipbooks: 0, downloads: 1 },
  records: [
    {
      id: "th-page-1",
      wpId: 1,
      language: "th",
      kind: "page",
      path: "/หน้า",
      sourceUrl: "https://www.rtrda.or.th/หน้า/",
      title: "หน้า",
      excerpt: "",
      contentHtml: "<p>เนื้อหา</p>",
      modified: "2025-01-01T00:00:00",
      date: "2025-01-01T00:00:00",
      parentPath: null,
      categoryIds: [],
      featuredMediaId: null,
      searchText: "เนื้อหา",
    },
    {
      id: "th-post-2",
      wpId: "2-extra",
      language: "th",
      kind: "post",
      path: "/ข่าว",
      sourceUrl: "https://www.rtrda.or.th/ข่าว/",
      title: "ข่าว",
      excerpt: "สรุป",
      contentHtml: "<p>ข่าว</p>",
      modified: "2025-02-01T00:00:00",
      date: "2025-02-01T00:00:00",
      parentPath: "/หน้า",
      categoryIds: [3],
      featuredMediaId: 9,
      authorId: 4,
    },
    {
      // Duplicate path: WordPress had a page and a post on the same slug.
      // The site serves the first manifest match, so the seeder keeps it.
      id: "th-post-3",
      wpId: 3,
      language: "th",
      kind: "post",
      path: "/หน้า",
      sourceUrl: "https://www.rtrda.or.th/หน้า/",
      title: "ซ้ำ",
      excerpt: "",
      contentHtml: "<p>ซ้ำ</p>",
      modified: "2025-03-01T00:00:00",
      date: "2025-03-01T00:00:00",
      parentPath: null,
      categoryIds: [],
      featuredMediaId: null,
    },
  ],
  categories: [
    { id: 3, language: "th", path: "/category/ข่าว", slug: "ข่าว", name: "ข่าว", count: 1, parent: 0 },
  ],
  media: [
    {
      id: 9,
      sourceUrl: "https://www.rtrda.or.th/wp-content/uploads/a.png",
      localPath: "/wp-content/uploads/a.png",
      title: "a",
      alt: "",
      width: 10,
      height: 20,
      mimeType: "image/png",
    },
  ],
  downloads: [
    {
      id: "dl-1",
      sourceUrl: "https://www.rtrda.or.th/sdc_download/1/?key=x",
      localPath: "/sdc-downloads/1/file.pdf",
      fileName: "file.pdf",
      mimeType: "application/pdf",
      sizeBytes: 123,
      title: "file",
      group: "1",
      sourcePages: ["/เอกสาร"],
    },
  ],
  navigation: { th: [{ label: "หน้าแรก", href: "/", path: "/", external: false, children: [] }], en: [] },
};

describe("manifestToRows", () => {
  const rows = manifestToRows(manifest);

  it("maps records, coercing wpId to string and defaulting optional fields", () => {
    expect(rows.records).toHaveLength(2);
    const [page, post] = rows.records;
    expect(page).toMatchObject({
      id: "th-page-1",
      wpId: "1",
      searchText: "เนื้อหา",
      authorId: null,
      featuredMediaId: null,
    });
    expect(post).toMatchObject({
      wpId: "2-extra",
      searchText: "",
      authorId: 4,
      featuredMediaId: 9,
      categoryIds: [3],
    });
  });

  it("keeps the first record when paths collide (matches records.find semantics)", () => {
    const winner = rows.records.find((row) => row.path === "/หน้า");
    expect(winner.id).toBe("th-page-1");
    expect(rows.skippedDuplicates).toEqual([{ path: "/หน้า", keptId: "th-page-1", droppedId: "th-post-3" }]);
  });

  it("coerces media ids to string", () => {
    expect(rows.media[0].id).toBe("9");
  });

  it("passes categories and downloads through", () => {
    expect(rows.categories).toHaveLength(1);
    expect(rows.downloads[0]).toMatchObject({ id: "dl-1", sizeBytes: 123 });
  });

  it("builds site meta entries", () => {
    const byKey = Object.fromEntries(rows.meta.map((entry) => [entry.key, entry.value]));
    expect(byKey.generatedAt).toBe("2026-06-11T07:52:02.737Z");
    expect(byKey.source).toBe("https://www.rtrda.or.th");
    expect(byKey.navigation.th).toHaveLength(1);
  });
});
