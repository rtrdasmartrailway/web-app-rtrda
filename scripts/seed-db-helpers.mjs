const ITA_2569_SUPPLEMENTAL_DOWNLOADS = [
  {
    id: "ita2569-o19-01",
    fileName: "แบบฟอร์มการมีส่วนร่วมo19_v3.pdf",
    sizeBytes: 903600,
    title: "แบบฟอร์มการมีส่วนร่วมo19_v3",
  },
  {
    id: "ita2569-o19-02",
    fileName: "เอกสารประกอบที่ 1 คำสั่งสทรที่52-2568.pdf",
    sizeBytes: 2609099,
    title: "เอกสารประกอบที่ 1 คำสั่งสทรที่52-2568",
  },
  {
    id: "ita2569-o19-03",
    fileName: "เอกสารประกอบที่ 2 รายงานประชุม ครั้งที่ 4-2568.pdf",
    sizeBytes: 1004907,
    title: "เอกสารประกอบที่ 2 รายงานประชุม ครั้งที่ 4-2568",
  },
  {
    id: "ita2569-o19-04",
    fileName: "เอกสารประกอบที่ 3 สรุปการประชุมTechnical Hearing.pdf",
    sizeBytes: 2214606,
    title: "เอกสารประกอบที่ 3 สรุปการประชุมTechnical Hearing",
  },
  {
    id: "ita2569-o19-05",
    fileName: "เอกสารประกอบที่ 4 รายงานประชุม ครั้งที่ 10-2568.pdf",
    sizeBytes: 1940053,
    title: "เอกสารประกอบที่ 4 รายงานประชุม ครั้งที่ 10-2568",
  },
  {
    id: "ita2569-o19-06",
    fileName: "เอกสารประกอบที่ 5 รายงานการประชุม ครั้งที่ 26(4)-2568.pdf",
    sizeBytes: 1350481,
    title: "เอกสารประกอบที่ 5 รายงานการประชุม ครั้งที่ 26(4)-2568",
  },
  {
    id: "ita2569-o19-07",
    fileName: "เอกสารประกอบที่ 6 รายงานการจัดทำประชาพิจารณ์.pdf",
    sizeBytes: 435085,
    title: "เอกสารประกอบที่ 6 รายงานการจัดทำประชาพิจารณ์",
  },
  {
    id: "ita2569-o21-01",
    fileName: "การประเมินความเสี่ยงทุจริต_5_ขั้นตอน_ตามคู.pdf",
    sizeBytes: 4773342,
    title: "การประเมินความเสี่ยงทุจริต_5_ขั้นตอน_ตามคู",
    group: "O21",
  },
  {
    id: "ita2569-o22-01",
    fileName: "รายงานผลการดำเนินงานตามแผนบริหารจัดการค.pdf",
    sizeBytes: 642714,
    title: "รายงานผลการดำเนินงานตามแผนบริหารจัดการค",
    group: "O22",
  },
].map((download) => ({
  ...download,
  sourceUrl: `https://www.rtrda.or.th/sdc_download/${download.id}/`,
  localPath: `/sdc-downloads/${download.id}.pdf`,
  mimeType: "application/pdf",
  group: download.group ?? "O19",
  sourcePages: ["/การประเมินคุณธรรมและคว"],
}));

function withSupplementalDownloads(downloads) {
  const existingIds = new Set(downloads.map((download) => download.id));
  const supplemental = ITA_2569_SUPPLEMENTAL_DOWNLOADS.filter(
    (download) => !existingIds.has(download.id),
  );

  return [...downloads, ...supplemental];
}

/**
 * Pure transforms turning the import manifest (src/data/wp-content.json) into
 * database rows for scripts/seed-db.mjs. No database access here.
 */

/**
 * Map a manifest to table rows. Records with a duplicate `path` are dropped
 * (first occurrence wins) because the site historically served the first
 * manifest match (`records.find`), and `ContentRecord.path` is unique.
 */
export function manifestToRows(manifest) {
  const records = [];
  const skippedDuplicates = [];
  const byPath = new Map();

  for (const record of manifest.records) {
    const existing = byPath.get(record.path);
    if (existing) {
      skippedDuplicates.push({
        path: record.path,
        keptId: existing.id,
        droppedId: record.id,
      });
      continue;
    }
    const row = {
      id: record.id,
      wpId: String(record.wpId),
      language: record.language,
      kind: record.kind,
      path: record.path,
      sourceUrl: record.sourceUrl,
      title: record.title,
      excerpt: record.excerpt,
      contentHtml: record.contentHtml,
      searchText: record.searchText ?? "",
      date: record.date,
      modified: record.modified,
      parentPath: record.parentPath,
      categoryIds: record.categoryIds ?? [],
      featuredMediaId: record.featuredMediaId ?? null,
      authorId: record.authorId ?? null,
    };
    byPath.set(record.path, row);
    records.push(row);
  }

  return {
    records,
    skippedDuplicates,
    categories: manifest.categories.map((category) => ({ ...category })),
    media: manifest.media.map((asset) => ({ ...asset, id: String(asset.id) })),
    downloads: withSupplementalDownloads(
      manifest.downloads.map((download) => ({ ...download })),
    ),
    meta: [
      { key: "generatedAt", value: manifest.generatedAt },
      { key: "source", value: manifest.source },
      { key: "navigation", value: manifest.navigation ?? { th: [], en: [] } },
    ],
  };
}
