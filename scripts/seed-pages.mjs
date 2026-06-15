#!/usr/bin/env node
/**
 * Seed the `pages` table from `kind === "page"` records.
 * Thai + English pages are merged into ONE row (paired by canonical path:
 * en path = "/en" + th path), with title/body per language in *_th / *_en
 * columns. Pages are addressed by the canonical (Thai) `path`. Run after
 * seed-media.mjs. Truncates first for a clean bilingual state.
 *
 * Run with: node scripts/seed-pages.mjs   (requires DATABASE_URL or .env.local)
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import sanitizeHtml from "sanitize-html";

function toPlainText(html) {
  if (!html) return "";
  const withBreaks = html
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/(h[1-6])>/gi, "\n\n");
  return sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const lastSegment = (p) => p.split("/").filter(Boolean).pop() ?? null;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

try {
  const env = await readFile(path.join(root, ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
} catch {
  // no .env.local, that's fine
}

if (!process.env.DATABASE_URL) {
  console.error("Error: DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL);

const manifestPath = path.join(root, "src/data/wp-content.json");
console.log("Reading wp-content.json…");
const { records } = JSON.parse(await readFile(manifestPath, "utf8"));

const mediaIds = new Set((await sql`SELECT id FROM media`).map((r) => r.id));

const pages = records.filter((r) => r.kind === "page");
const enByCanonical = new Map();
for (const r of pages) {
  if (r.language === "en") {
    const canonical = r.path.replace(/^\/en/, "") || "/";
    enByCanonical.set(canonical, r);
  }
}

// Deduplicate Thai pages by path (last wins).
const thByPath = new Map();
for (const r of pages) {
  if (r.language === "th") thByPath.set(r.path, r);
}
const thPages = [...thByPath.values()];
console.log(`Found ${thPages.length} Thai page(s); merging English twins.`);

const rows = thPages.map((th) => {
  const en = enByCanonical.get(th.path) ?? {};
  const fid = Number(th.featuredMediaId);
  const featured = Number.isInteger(fid) && mediaIds.has(fid) ? fid : null;
  return {
    slug: lastSegment(th.path) ?? "home",
    path: th.path,
    title_th: th.title ?? "",
    title_en: en.title ?? "",
    body_th: toPlainText(th.contentHtml),
    body_en: toPlainText(en.contentHtml),
    parent_slug: th.parentPath ? lastSegment(th.parentPath) : null,
    parent_path: th.parentPath ?? null,
    featured_image_id: featured,
    attachments: sql.json([]),
    sort_order: 0,
    updated_at: th.modified ? new Date(th.modified) : new Date(),
  };
});

await sql`DELETE FROM pages`;
const BATCH = 200;
for (let i = 0; i < rows.length; i += BATCH) {
  await sql`INSERT INTO pages ${sql(rows.slice(i, i + BATCH))}`;
  process.stdout.write(`  ${Math.min(i + BATCH, rows.length)}/${rows.length}\r`);
}

console.log(`\nDone — ${rows.length} bilingual page(s) inserted.`);
await sql.end();
