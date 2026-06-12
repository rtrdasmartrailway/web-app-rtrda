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
    downloads: manifest.downloads.map((download) => ({ ...download })),
    meta: [
      { key: "generatedAt", value: manifest.generatedAt },
      { key: "source", value: manifest.source },
      { key: "navigation", value: manifest.navigation ?? { th: [], en: [] } },
    ],
  };
}
