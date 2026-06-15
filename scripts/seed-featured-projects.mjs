#!/usr/bin/env node
/**
 * Seed featured_projects from wp-content.json pages under /ผลงานและโครงการเด่น.
 * Thai + English are merged into ONE row (paired by slug = last path segment),
 * with title/excerpt/body per language in *_th / *_en columns.
 * Truncates first for a clean bilingual state.
 *
 * Run with: node scripts/seed-featured-projects.mjs  (requires DATABASE_URL / .env.local)
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

const isProject = (r, parent) => r.kind === "page" && r.parentPath === parent;
const thProjects = records.filter((r) => isProject(r, "/ผลงานและโครงการเด่น"));
const enBySlug = new Map();
for (const r of records.filter((r) => isProject(r, "/en/ผลงานและโครงการเด่น"))) {
  enBySlug.set(lastSegment(r.path), r);
}
console.log(`Found ${thProjects.length} Thai project(s); merging English twins.`);

const rows = thProjects.map((th) => {
  const slug = lastSegment(th.path) ?? String(th.wpId);
  const en = enBySlug.get(slug) ?? {};
  return {
    slug,
    title_th: th.title ?? "",
    title_en: en.title ?? "",
    excerpt_th: th.excerpt ?? "",
    excerpt_en: en.excerpt ?? "",
    body_th: toPlainText(th.contentHtml),
    body_en: toPlainText(en.contentHtml),
    category: "",
    featured_image_id: null,
    attachments: sql.json([]),
    published_at: th.date ? new Date(th.date) : null,
    updated_at: th.modified ? new Date(th.modified) : new Date(),
  };
});

await sql`DELETE FROM featured_projects`;
if (rows.length > 0) await sql`INSERT INTO featured_projects ${sql(rows)}`;
for (const r of rows) console.log(`  ✓ ${r.title_th}`);

console.log(`\nDone — ${rows.length} bilingual featured project(s) inserted.`);
await sql.end();
