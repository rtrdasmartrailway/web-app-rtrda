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
    {
      id: 3,
      language: "th",
      path: "/category/ข่าว",
      slug: "ข่าว",
      name: "ข่าว",
      count: 1,
      parent: 0,
    },
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
  navigation: {
    th: [{ label: "หน้าแรก", href: "/", path: "/", external: false, children: [] }],
    en: [],
  },
};

describe("manifestToRows", () => {
  const rows = manifestToRows(manifest);

  it("maps records, coercing wpId to string and defaulting optional fields", () => {
    expect(rows.records).toHaveLength(11);
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
    expect(rows.skippedDuplicates).toEqual([
      { path: "/หน้า", keptId: "th-page-1", droppedId: "th-post-3" },
    ]);
  });

  it("coerces media ids to string", () => {
    expect(rows.media[0].id).toBe("9");
  });

  it("passes categories and downloads through", () => {
    expect(rows.categories).toHaveLength(1);
    expect(rows.downloads[0]).toMatchObject({ id: "dl-1", sizeBytes: 123 });
  });

  it("adds supplemental ITA 2569 O19 downloads", () => {
    const o19Downloads = rows.downloads.filter((download) =>
      download.id.startsWith("ita2569-o19-"),
    );

    expect(o19Downloads.map((download) => download.id)).toEqual([
      "ita2569-o19-01",
      "ita2569-o19-02",
      "ita2569-o19-03",
      "ita2569-o19-04",
      "ita2569-o19-05",
      "ita2569-o19-06",
      "ita2569-o19-07",
      "ita2569-o19-08",
    ]);
    expect(o19Downloads[0]).toMatchObject({
      localPath: "/sdc-downloads/ita2569-o19-01.pdf",
      mimeType: "application/pdf",
      group: "O19",
      sourcePages: ["/การประเมินคุณธรรมและคว"],
    });
  });

  it("adds supplemental ITA 2569 O21 and O22 downloads", () => {
    expect(rows.downloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ita2569-o21-01",
          localPath: "/sdc-downloads/ita2569-o21-01.pdf",
          fileName: "การประเมินความเสี่ยงทุจริต_5_ขั้นตอน.pdf",
          mimeType: "application/pdf",
          group: "O21",
          sourcePages: ["/การประเมินคุณธรรมและคว"],
        }),
        expect.objectContaining({
          id: "ita2569-o22-01",
          localPath: "/sdc-downloads/ita2569-o22-01.pdf",
          fileName: "รายงานผลการดำเนินงานตามแผนบริหารจัดการค.pdf",
          mimeType: "application/pdf",
          group: "O22",
          sourcePages: ["/การประเมินคุณธรรมและคว"],
        }),
      ]),
    );
  });

  it("adds the supplemental No Gift Policy news record and media", () => {
    const news = rows.records.find((record) => record.id === "th-post-8063");
    expect(news).toMatchObject({
      wpId: "8063",
      language: "th",
      kind: "post",
      path: "/สทร-ร่วมประกาศเจตนารมณ์-no-gift-policy-2569",
      categoryIds: [7],
      featuredMediaId: 8063,
      date: "2026-02-24T00:00:00",
    });
    expect(news?.title).toContain("No Gift Policy");
    expect(news?.contentHtml).toContain(
      "/wp-content/uploads/2026/02/no-gift-policy-240269-10.jpg",
    );
    expect(news?.searchText).toContain("ต่อต้านการทุจริตคอร์รัปชัน");

    const noGiftMedia = rows.media.filter((asset) =>
      asset.localPath.includes("/wp-content/uploads/2026/02/no-gift-policy-240269-"),
    );
    expect(noGiftMedia).toHaveLength(10);
    expect(noGiftMedia[0]).toMatchObject({
      id: "8063",
      localPath: "/wp-content/uploads/2026/02/no-gift-policy-240269-01.jpg",
      width: 2048,
      height: 1365,
      mimeType: "image/jpeg",
    });
  });

  it("adds the restored Facebook news records and media", () => {
    const restoredNews = rows.records.filter((record) =>
      record.id.startsWith("th-post-910"),
    );
    expect(restoredNews).toHaveLength(8);
    expect(restoredNews.map((record) => record.title)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Siamese Train"),
        expect.stringContaining("Incubation Team"),
        expect.stringContaining("IIT"),
      ]),
    );
    expect(restoredNews.map((record) => record.date)).toEqual([
      "2026-06-24T09:00:00",
      "2026-06-23T13:00:00",
      "2026-06-23T10:30:00",
      "2026-06-22T10:00:00",
      "2026-06-20T09:00:00",
      "2026-06-19T09:00:00",
      "2026-06-18T09:00:00",
      "2026-06-13T09:00:00",
    ]);
    expect(restoredNews[0].contentHtml).toContain("การพัฒนารถไฟท่องเที่ยว Siamese Train");
    expect(restoredNews[0].contentHtml).not.toContain("ดูโพสต์ต้นทางบน Facebook");
    expect(
      restoredNews.find((record) => record.id === "th-post-91006")?.contentHtml,
    ).toContain("Workshop ประเมินศักยภาพองค์กร");

    const restoredMedia = rows.media.filter((asset) =>
      asset.localPath.includes("/wp-content/uploads/news-2569/fb-"),
    );
    expect(restoredMedia).toHaveLength(8);
    expect(restoredMedia[0]).toMatchObject({ mimeType: "image/jpeg" });
  });

  it("adds the No Gift Policy and restored Facebook news links to the news category listing", () => {
    const rowsWithCategory = manifestToRows({
      ...manifest,
      records: [
        ...manifest.records,
        {
          id: "th-category-7",
          wpId: 7,
          language: "th",
          kind: "category",
          path: "/category/ข่าวและกิจกรรม",
          sourceUrl: "https://www.rtrda.or.th/category/ข่าวและกิจกรรม/",
          title: "ข่าวและกิจกรรม",
          excerpt: "",
          contentHtml:
            '<ul class="wp-import-list"><li><a href="/existing-news">ข่าวเดิม</a></li></ul>',
          modified: "2026-01-01T00:00:00",
          date: "2026-01-01T00:00:00",
          parentPath: null,
          categoryIds: [],
          featuredMediaId: null,
        },
      ],
      categories: [
        ...manifest.categories,
        {
          id: 7,
          language: "th",
          path: "/category/ข่าวและกิจกรรม",
          slug: "ข่าวและกิจกรรม",
          name: "ข่าวและกิจกรรม",
          count: 1,
          parent: 0,
        },
      ],
    });

    const category = rowsWithCategory.records.find(
      (record) => record.path === "/category/ข่าวและกิจกรรม",
    );
    expect(category?.contentHtml).toContain(
      "/สทร-ร่วมประกาศเจตนารมณ์-no-gift-policy-2569",
    );
    expect(category?.contentHtml).toContain("No Gift Policy");
    expect(category?.contentHtml.indexOf("no-gift-policy-2569")).toBeLessThan(
      category?.contentHtml.indexOf("/existing-news") ?? Number.POSITIVE_INFINITY,
    );
    expect(
      rowsWithCategory.categories.find(
        (category) => category.id === 7 && category.language === "th",
      )?.count,
    ).toBe(10);
    expect(category?.contentHtml).toContain("Siamese Train");
    expect(category?.contentHtml).toContain("Incubation Team");
  });

  it("does not duplicate supplemental ITA 2569 downloads from the manifest", () => {
    const rowsWithExistingO19 = manifestToRows({
      ...manifest,
      downloads: [
        ...manifest.downloads,
        {
          id: "ita2569-o19-01",
          sourceUrl: "https://www.rtrda.or.th/sdc_download/ita2569-o19-01/",
          localPath: "/sdc-downloads/ita2569-o19-01.pdf",
          fileName: "existing.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1,
          title: "existing",
          group: "O19",
          sourcePages: ["/existing"],
        },
        {
          id: "ita2569-o21-01",
          sourceUrl: "https://www.rtrda.or.th/sdc_download/ita2569-o21-01/",
          localPath: "/sdc-downloads/ita2569-o21-01.pdf",
          fileName: "existing-o21.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1,
          title: "existing O21",
          group: "O21",
          sourcePages: ["/existing"],
        },
      ],
    });

    expect(
      rowsWithExistingO19.downloads.filter(
        (download) => download.id === "ita2569-o19-01",
      ),
    ).toHaveLength(1);
    expect(
      rowsWithExistingO19.downloads.filter(
        (download) => download.id === "ita2569-o21-01",
      ),
    ).toHaveLength(1);
  });

  it("builds site meta entries", () => {
    const byKey = Object.fromEntries(rows.meta.map((entry) => [entry.key, entry.value]));
    expect(byKey.generatedAt).toBe("2026-06-11T07:52:02.737Z");
    expect(byKey.source).toBe("https://www.rtrda.or.th");
    expect(byKey.navigation.th).toHaveLength(1);
  });
});
