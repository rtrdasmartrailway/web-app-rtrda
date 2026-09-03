import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import pg from "pg";
import { htmlToText, stripImportedChrome } from "./import-wordpress-sanitize.mjs";

const oldPagePath = "/ผลงานและโครงการเด่น/ยุทธศาสตร์-เทคโนโลยี-ระบ";
const pagePath = "/เอกสารเผยแพร่/ยุทธศาสตร์-เทคโนโลยีระบบราง-2571-2575";
const parentPath = "/เอกสารเผยแพร่";
const heading = "ยุทธศาสตร์ด้านเทคโนโลยีระบบรางของประเทศ (พ.ศ. 2571 - พ.ศ. 2575)";
const documentId = "rail-technology-strategy-2571-2575";
const pdfHref = `/documents/${documentId}.pdf`;
const manifestPath = path.join(process.cwd(), "src/data/wp-content.json");

const contentHtml = `
<figure class="wp-block-table"><table><thead><tr><th>ลำดับ</th><th>เอกสาร</th><th>ไฟล์</th></tr></thead><tbody><tr><td>1</td><td>${heading}</td><td><a href="${pdfHref}" data-pdf-reader-ignore="true" data-protected-preview="${documentId}">อ่านเพิ่มเติม</a> | <a href="${pdfHref}" data-pdf-reader-ignore="true" data-protected-download="${documentId}">ดาวน์โหลด PDF</a></td></tr></tbody></table></figure>`;

function removeDocument(html) {
  const $ = load(html, null, false);
  const documentHeading = $("h1,h2,h3,h4,h5,h6").filter(
    (_, element) => $(element).text().trim() === heading,
  );
  if (documentHeading.length > 1) {
    throw new Error(
      `Expected at most one "${heading}" heading, found ${documentHeading.length}.`,
    );
  }
  if (documentHeading.length === 1) {
    documentHeading
      .first()
      .next(".strategy-document-actions, .simple-download-counter")
      .first()
      .remove();
    documentHeading.remove();
  }
  return $.root().html() ?? "";
}

const rawManifest = JSON.parse(await readFile(manifestPath, "utf8"));
const oldManifestRecord = rawManifest.records.find(
  (record) => record.path === oldPagePath,
);
if (!oldManifestRecord) throw new Error(`Manifest record not found for ${oldPagePath}.`);

const nextOldManifestHtml = removeDocument(oldManifestRecord.contentHtml);
const nextOldContentHtml = stripImportedChrome(nextOldManifestHtml);
const now = new Date().toISOString();
const publicationRecord = {
  id: "rtrda-publication-rail-technology-strategy-2571-2575",
  wpId: "rtrda-publication-rail-technology-strategy-2571-2575",
  language: "th",
  kind: "page",
  path: pagePath,
  sourceUrl: `https://test.rtrda.or.th${pagePath}`,
  title: heading,
  excerpt: heading,
  contentHtml,
  searchText: htmlToText(contentHtml),
  modified: now,
  date: now,
  parentPath,
  categoryIds: [],
  featuredMediaId: null,
  authorId: null,
};

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const oldRecord = await client.query('SELECT id FROM "ContentRecord" WHERE path = $1', [
    oldPagePath,
  ]);
  if (!oldRecord.rows[0])
    throw new Error(`Database record not found for ${oldPagePath}.`);

  await client.query(
    'UPDATE "ContentRecord" SET "contentHtml" = $1, "searchText" = $2, modified = $3 WHERE id = $4',
    [nextOldContentHtml, htmlToText(nextOldContentHtml), now, oldRecord.rows[0].id],
  );
  await client.query(
    `INSERT INTO "ContentRecord" (id, "wpId", language, kind, path, "sourceUrl", title, excerpt, "contentHtml", "searchText", date, modified, "parentPath", "categoryIds", "featuredMediaId", "authorId")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     ON CONFLICT (path) DO UPDATE SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, "contentHtml" = EXCLUDED."contentHtml", "searchText" = EXCLUDED."searchText", modified = EXCLUDED.modified, "parentPath" = EXCLUDED."parentPath"`,
    [
      publicationRecord.id,
      publicationRecord.wpId,
      publicationRecord.language,
      publicationRecord.kind,
      publicationRecord.path,
      publicationRecord.sourceUrl,
      publicationRecord.title,
      publicationRecord.excerpt,
      publicationRecord.contentHtml,
      publicationRecord.searchText,
      publicationRecord.date,
      publicationRecord.modified,
      publicationRecord.parentPath,
      publicationRecord.categoryIds,
      publicationRecord.featuredMediaId,
      publicationRecord.authorId,
    ],
  );
  console.log("Publication page and source page updated.");
} finally {
  await client.end();
}

oldManifestRecord.contentHtml = nextOldManifestHtml;
oldManifestRecord.searchText = htmlToText(nextOldContentHtml);
oldManifestRecord.modified = now;
const existingPublicationRecord = rawManifest.records.find(
  (record) => record.path === pagePath,
);
if (existingPublicationRecord) {
  Object.assign(existingPublicationRecord, publicationRecord);
} else {
  rawManifest.records.push(publicationRecord);
}
await writeFile(manifestPath, `${JSON.stringify(rawManifest, null, 2)}\n`);
console.log("Import manifest updated.");
