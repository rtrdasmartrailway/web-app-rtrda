import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import pg from "pg";
import { htmlToText, stripImportedChrome } from "./import-wordpress-sanitize.mjs";

const pagePath = "/ผลงานและโครงการเด่น/ยุทธศาสตร์-เทคโนโลยี-ระบ";
const heading = "ยุทธศาสตร์ด้านเทคโนโลยีระบบรางของประเทศ (พ.ศ. 2571 - พ.ศ. 2575)";
const pdfPath = "/wp-content/uploads/2026/09/rail-technology-strategy-2571-2575.pdf";
const pdfHref = `${pdfPath}?v=20260902-2`;
const backupKey = "strategy_412_backup_before_2571_2575_document";
const manifestPath = path.join(process.cwd(), "src/data/wp-content.json");

const documentHtml = `
<h3 class="wp-block-heading"><strong>${heading}</strong></h3>
<div class="strategy-document-actions">
  <span class="strategy-document-label">${heading}</span>
  <a class="strategy-document-preview" href="${pdfHref}">อ่านเพิ่มเติม</a>
  <a class="simple-download-counter-link" href="${pdfHref}" download="download" data-pdf-reader-ignore="true">ดาวน์โหลด</a>
</div>`;

function insertDocument(html) {
  const normalizedHtml = html.replaceAll(`href="${pdfPath}"`, `href="${pdfHref}"`);

  if (normalizedHtml.includes(heading)) {
    const $ = load(normalizedHtml, null, false);
    const documentHeading = $("h1,h2,h3,h4,h5,h6").filter(
      (_, element) => $(element).text().trim() === heading,
    );

    if (documentHeading.length !== 1) {
      throw new Error(
        `Expected one \"${heading}\" heading, found ${documentHeading.length}.`,
      );
    }

    documentHeading
      .first()
      .next(".strategy-document-actions, .simple-download-counter")
      .first()
      .replaceWith(documentHtml.replace(/^\n<h3[^>]*>.*?<\/h3>\n/, ""));
    return $.root().html() ?? "";
  }

  const $ = load(normalizedHtml, null, false);
  const currentDeliverables = $("h1,h2,h3,h4,h5,h6").filter(
    (_, element) => $(element).text().trim() === "ผลงานปัจจุบัน",
  );

  if (currentDeliverables.length !== 1) {
    throw new Error(
      `Expected one \"ผลงานปัจจุบัน\" heading, found ${currentDeliverables.length}.`,
    );
  }

  currentDeliverables.first().before(documentHtml);
  return $.root().html() ?? "";
}

const rawManifest = JSON.parse(await readFile(manifestPath, "utf8"));
const manifestRecord = rawManifest.records.find((record) => record.path === pagePath);
if (!manifestRecord) {
  throw new Error(`Manifest record not found for ${pagePath}.`);
}

const nextManifestHtml = insertDocument(manifestRecord.contentHtml);
const nextContentHtml = stripImportedChrome(nextManifestHtml);
const nextSearchText = htmlToText(nextContentHtml);

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const result = await client.query(
    'SELECT id, "contentHtml" FROM "ContentRecord" WHERE path = $1',
    [pagePath],
  );
  const record = result.rows[0];
  if (!record) {
    throw new Error(`Database record not found for ${pagePath}.`);
  }

  if (record.contentHtml !== nextContentHtml) {
    await client.query(
      'INSERT INTO "SiteMeta" (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING',
      [backupKey, JSON.stringify(record.contentHtml)],
    );
    await client.query(
      'UPDATE "ContentRecord" SET "contentHtml" = $1, "searchText" = $2, modified = $3 WHERE id = $4',
      [nextContentHtml, nextSearchText, new Date().toISOString(), record.id],
    );
    console.log("Database content updated.");
  } else {
    console.log("Database content already includes the document.");
  }

  if (manifestRecord.contentHtml !== nextManifestHtml) {
    manifestRecord.contentHtml = nextManifestHtml;
    manifestRecord.searchText = nextSearchText;
    manifestRecord.modified = new Date().toISOString();
    await writeFile(manifestPath, `${JSON.stringify(rawManifest, null, 2)}\n`);
    console.log("Import manifest updated.");
  } else {
    console.log("Import manifest already includes the document.");
  }
} finally {
  await client.end();
}
