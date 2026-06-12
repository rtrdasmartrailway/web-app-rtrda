#!/usr/bin/env node
/**
 * One-time seed: reads src/data/wp-content.json and inserts all content into Postgres.
 * Run with: node scripts/seed-postgres.mjs
 * Requires DATABASE_URL env var (or .env.local).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Load .env.local if present
try {
  const env = await readFile(path.join(root, ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  }
} catch {
  // no .env.local, that's fine
}

if (!process.env.DATABASE_URL) {
  console.error("Error: DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL);

// ---------------------------------------------------------------------------
// Load manifest
// ---------------------------------------------------------------------------
const manifestPath = path.join(root, "src/data/wp-content.json");
console.log("Reading wp-content.json…");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const { records, media, downloads, navigation = {}, generatedAt, source } = manifest;
console.log(`  records: ${records.length}, media: ${media.length}, downloads: ${downloads.length}`);

// ---------------------------------------------------------------------------
// Create tables if they don't exist (idempotent)
// ---------------------------------------------------------------------------
console.log("Creating tables…");
await sql`
  CREATE TABLE IF NOT EXISTS wp_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`;

await sql`
  CREATE TABLE IF NOT EXISTS wp_media (
    id                SERIAL PRIMARY KEY,
    wp_id             TEXT NOT NULL,
    source_url        TEXT NOT NULL DEFAULT '',
    local_path        TEXT NOT NULL,
    title             TEXT NOT NULL DEFAULT '',
    alt               TEXT NOT NULL DEFAULT '',
    width             INTEGER,
    height            INTEGER,
    mime_type         TEXT NOT NULL DEFAULT ''
  )`;

await sql`
  CREATE TABLE IF NOT EXISTS wp_downloads (
    id          TEXT PRIMARY KEY,
    source_url  TEXT NOT NULL DEFAULT '',
    local_path  TEXT NOT NULL,
    file_name   TEXT NOT NULL DEFAULT '',
    mime_type   TEXT NOT NULL DEFAULT '',
    size_bytes  INTEGER NOT NULL DEFAULT 0,
    title       TEXT NOT NULL DEFAULT '',
    "group"     TEXT NOT NULL DEFAULT ''
  )`;

await sql`
  CREATE TABLE IF NOT EXISTS wp_content (
    id                   SERIAL PRIMARY KEY,
    wp_id                TEXT NOT NULL,
    language             TEXT NOT NULL,
    kind                 TEXT NOT NULL,
    path                 TEXT NOT NULL UNIQUE,
    source_url           TEXT NOT NULL DEFAULT '',
    title                TEXT NOT NULL,
    excerpt              TEXT NOT NULL DEFAULT '',
    content_html         TEXT NOT NULL DEFAULT '',
    modified             TEXT NOT NULL DEFAULT '',
    date                 TEXT NOT NULL DEFAULT '',
    parent_path          TEXT,
    featured_media_id    TEXT,
    featured_media_path  TEXT
  )`;

await sql`CREATE INDEX IF NOT EXISTS wp_content_language_idx    ON wp_content (language)`;
await sql`CREATE INDEX IF NOT EXISTS wp_content_parent_path_idx ON wp_content (parent_path)`;

// pg_trgm for fast Thai ILIKE search
await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
await sql`CREATE INDEX IF NOT EXISTS wp_content_title_trgm   ON wp_content USING gin(title   gin_trgm_ops)`;
await sql`CREATE INDEX IF NOT EXISTS wp_content_excerpt_trgm ON wp_content USING gin(excerpt gin_trgm_ops)`;

await sql`
  CREATE TABLE IF NOT EXISTS wp_navigation (
    id          SERIAL PRIMARY KEY,
    language    TEXT NOT NULL,
    label       TEXT NOT NULL,
    href        TEXT NOT NULL,
    path        TEXT,
    external    BOOLEAN NOT NULL DEFAULT FALSE,
    parent_id   INTEGER,
    sort_order  INTEGER NOT NULL DEFAULT 0
  )`;

// ---------------------------------------------------------------------------
// Build a media lookup for featuredMediaPath resolution
// ---------------------------------------------------------------------------
const mediaById = new Map();
for (const asset of media) {
  mediaById.set(String(asset.id), asset);
}

function resolveFeaturedMediaPath(record) {
  if (!record.featuredMediaId) return null;
  const asset = mediaById.get(String(record.featuredMediaId));
  if (!asset?.mimeType?.startsWith("image/")) return null;
  return asset.localPath ?? null;
}

// ---------------------------------------------------------------------------
// Seed wp_meta
// ---------------------------------------------------------------------------
console.log("Seeding wp_meta…");
await sql`
  INSERT INTO wp_meta (key, value)
  VALUES ('generatedAt', ${generatedAt ?? ""}), ('source', ${source ?? ""})
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;

// ---------------------------------------------------------------------------
// Seed wp_media (batch)
// ---------------------------------------------------------------------------
console.log(`Seeding ${media.length} media assets…`);
const BATCH = 500;
for (let i = 0; i < media.length; i += BATCH) {
  const chunk = media.slice(i, i + BATCH);
  await sql`
    INSERT INTO wp_media ${sql(chunk.map((m) => ({
      wp_id:      String(m.id),
      source_url: m.sourceUrl ?? "",
      local_path: m.localPath ?? "",
      title:      m.title ?? "",
      alt:        m.alt ?? "",
      width:      m.width ?? null,
      height:     m.height ?? null,
      mime_type:  m.mimeType ?? "",
    })))}
    ON CONFLICT DO NOTHING`;
}

// ---------------------------------------------------------------------------
// Seed wp_downloads
// ---------------------------------------------------------------------------
console.log(`Seeding ${downloads.length} downloads…`);
if (downloads.length > 0) {
  await sql`
    INSERT INTO wp_downloads ${sql(downloads.map((d) => ({
      id:         String(d.id),
      source_url: d.sourceUrl ?? "",
      local_path: d.localPath ?? "",
      file_name:  d.fileName ?? "",
      mime_type:  d.mimeType ?? "",
      size_bytes: d.sizeBytes ?? 0,
      title:      d.title ?? "",
      group:      d.group ?? "",
    })))}
    ON CONFLICT (id) DO UPDATE SET
      source_url = EXCLUDED.source_url,
      local_path = EXCLUDED.local_path,
      file_name  = EXCLUDED.file_name,
      mime_type  = EXCLUDED.mime_type,
      size_bytes = EXCLUDED.size_bytes,
      title      = EXCLUDED.title,
      "group"    = EXCLUDED."group"`;
}

// ---------------------------------------------------------------------------
// Seed wp_content
// ---------------------------------------------------------------------------
// Deduplicate by path — keep last occurrence (most recent wins)
const recordsByPath = new Map();
for (const r of records) recordsByPath.set(r.path, r);
const uniqueRecords = [...recordsByPath.values()];
console.log(`Seeding ${uniqueRecords.length} content records (${records.length - uniqueRecords.length} duplicates removed)…`);
for (let i = 0; i < uniqueRecords.length; i += BATCH) {
  const chunk = uniqueRecords.slice(i, i + BATCH);
  await sql`
    INSERT INTO wp_content ${sql(chunk.map((r) => ({
      wp_id:                String(r.id ?? r.wpId ?? ""),
      language:             r.language,
      kind:                 r.kind,
      path:                 r.path,
      source_url:           r.sourceUrl ?? "",
      title:                r.title ?? "",
      excerpt:              r.excerpt ?? "",
      content_html:         r.contentHtml ?? "",
      modified:             r.modified ?? "",
      date:                 r.date ?? "",
      parent_path:          r.parentPath ?? null,
      featured_media_id:    r.featuredMediaId != null ? String(r.featuredMediaId) : null,
      featured_media_path:  resolveFeaturedMediaPath(r),
    })))}
    ON CONFLICT (path) DO UPDATE SET
      wp_id               = EXCLUDED.wp_id,
      language            = EXCLUDED.language,
      kind                = EXCLUDED.kind,
      source_url          = EXCLUDED.source_url,
      title               = EXCLUDED.title,
      excerpt             = EXCLUDED.excerpt,
      content_html        = EXCLUDED.content_html,
      modified            = EXCLUDED.modified,
      date                = EXCLUDED.date,
      parent_path         = EXCLUDED.parent_path,
      featured_media_id   = EXCLUDED.featured_media_id,
      featured_media_path = EXCLUDED.featured_media_path`;
}

// ---------------------------------------------------------------------------
// Seed wp_navigation (flatten tree, clear first for idempotency)
// ---------------------------------------------------------------------------
console.log("Seeding navigation…");
await sql`DELETE FROM wp_navigation`;

function flattenNav(items, language, parentId, startOrder) {
  const rows = [];
  let order = startOrder;
  for (const item of items ?? []) {
    rows.push({
      language,
      label:      item.label ?? "",
      href:       item.href ?? "",
      path:       item.path ?? null,
      external:   item.external ?? false,
      parent_id:  parentId,
      sort_order: order++,
    });
    if (item.children?.length) {
      const parentOrder = rows[rows.length - 1].sort_order;
      rows.push(...flattenNav(item.children, language, parentOrder, 0));
    }
  }
  return rows;
}

const navRows = [
  ...flattenNav(navigation.th ?? [], "th", null, 0),
  ...flattenNav(navigation.en ?? [], "en", null, 0),
];

if (navRows.length > 0) {
  await sql`INSERT INTO wp_navigation ${sql(navRows)}`;
}

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------
await sql.end();
console.log("\nSeed complete.");
console.log(`  wp_content:   ${records.length} rows`);
console.log(`  wp_media:     ${media.length} rows`);
console.log(`  wp_downloads: ${downloads.length} rows`);
console.log(`  wp_navigation: ${navRows.length} rows`);
