/**
 * One-time/idempotent seed: load the audited import manifest
 * (src/data/wp-content.json) into Postgres. Full reload — every run wipes and
 * rewrites all content tables inside a transaction.
 *
 * Usage: npm run db:seed   (DATABASE_URL from .env; run migrations first)
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";
import { manifestToRows } from "./seed-db-helpers.mjs";

process.loadEnvFile();

const MANIFEST_PATH = path.join(process.cwd(), "src/data/wp-content.json");
const CHUNK_SIZE = 100;

function chunk(rows, size) {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

/** Multi-row INSERT with parameter placeholders. */
async function insertRows(client, table, columns, rows, toValues) {
  for (const batch of chunk(rows, CHUNK_SIZE)) {
    const params = [];
    const tuples = batch.map((row) => {
      const values = toValues(row);
      const placeholders = values.map((value) => {
        params.push(value);
        return `$${params.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    const quotedColumns = columns.map((column) => `"${column}"`).join(", ");
    await client.query(
      `INSERT INTO "${table}" (${quotedColumns}) VALUES ${tuples.join(", ")}`,
      params,
    );
  }
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const rows = manifestToRows(manifest);

  for (const duplicate of rows.skippedDuplicates) {
    console.warn(
      `duplicate path ${duplicate.path}: kept ${duplicate.keptId}, dropped ${duplicate.droppedId}`,
    );
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      'TRUNCATE "ContentRecord", "Category", "MediaAsset", "Download", "SiteMeta"',
    );

    await insertRows(
      client,
      "ContentRecord",
      [
        "id",
        "wpId",
        "language",
        "kind",
        "path",
        "sourceUrl",
        "title",
        "excerpt",
        "contentHtml",
        "searchText",
        "date",
        "modified",
        "parentPath",
        "categoryIds",
        "featuredMediaId",
        "authorId",
      ],
      rows.records,
      (row) => [
        row.id,
        row.wpId,
        row.language,
        row.kind,
        row.path,
        row.sourceUrl,
        row.title,
        row.excerpt,
        row.contentHtml,
        row.searchText,
        row.date,
        row.modified,
        row.parentPath,
        row.categoryIds,
        row.featuredMediaId,
        row.authorId,
      ],
    );

    await insertRows(
      client,
      "Category",
      ["id", "language", "path", "slug", "name", "count", "parent"],
      rows.categories,
      (row) => [row.id, row.language, row.path, row.slug, row.name, row.count, row.parent],
    );

    await insertRows(
      client,
      "MediaAsset",
      ["id", "sourceUrl", "localPath", "title", "alt", "width", "height", "mimeType"],
      rows.media,
      (row) => [
        row.id,
        row.sourceUrl,
        row.localPath,
        row.title,
        row.alt,
        row.width,
        row.height,
        row.mimeType,
      ],
    );

    await insertRows(
      client,
      "Download",
      [
        "id",
        "sourceUrl",
        "localPath",
        "fileName",
        "mimeType",
        "sizeBytes",
        "title",
        "group",
        "sourcePages",
      ],
      rows.downloads,
      (row) => [
        row.id,
        row.sourceUrl,
        row.localPath,
        row.fileName,
        row.mimeType,
        row.sizeBytes,
        row.title,
        row.group,
        row.sourcePages,
      ],
    );

    await insertRows(client, "SiteMeta", ["key", "value"], rows.meta, (row) => [
      row.key,
      JSON.stringify(row.value),
    ]);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  const counts = await client.query(
    `SELECT
       (SELECT count(*) FROM "ContentRecord") AS records,
       (SELECT count(*) FROM "Category") AS categories,
       (SELECT count(*) FROM "MediaAsset") AS media,
       (SELECT count(*) FROM "Download") AS downloads,
       (SELECT count(*) FROM "SiteMeta") AS meta`,
  );
  console.log("seeded:", counts.rows[0]);
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
