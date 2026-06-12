#!/usr/bin/env node
/**
 * Seed featured_projects from wp-content.json records under /ผลงานและโครงการเด่น
 * Run with: node scripts/seed-featured-projects.mjs
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

const manifestPath = path.join(root, "src/data/wp-content.json");
console.log("Reading wp-content.json…");
const { records } = JSON.parse(await readFile(manifestPath, "utf8"));

const projects = records.filter(
  (r) => r.kind === "page" && r.parentPath === "/ผลงานและโครงการเด่น",
);
console.log(`Found ${projects.length} featured project record(s).`);

for (const r of projects) {
  const slug = r.path.split("/").filter(Boolean).pop() ?? String(r.wpId);
  await sql`
    INSERT INTO featured_projects
      (language, slug, title, excerpt, body, category,
       featured_image_id, attachments, published_at, updated_at)
    VALUES (
      ${r.language},
      ${slug},
      ${r.title},
      ${r.excerpt ?? ""},
      ${r.contentHtml ?? ""},
      ${""},
      ${null},
      ${"[]"},
      ${r.date ? new Date(r.date) : null},
      ${r.modified ? new Date(r.modified) : new Date()}
    )
    ON CONFLICT (slug) DO UPDATE SET
      title        = EXCLUDED.title,
      excerpt      = EXCLUDED.excerpt,
      body         = EXCLUDED.body,
      published_at = EXCLUDED.published_at,
      updated_at   = EXCLUDED.updated_at
  `;
  console.log(`  ✓ ${r.title}`);
}

console.log(`\nDone — ${projects.length} record(s) upserted.`);
await sql.end();
