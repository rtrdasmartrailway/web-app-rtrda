#!/usr/bin/env node
/**
 * Seed the `flipbooks` table from all `kind === "flipbook"` records.
 * Addressed by full URL `path`; `pdf_path` stores the upstream document URL the
 * FlipbookPage opens. `slug` = path without leading slash (kept globally unique).
 *
 * Run with: node scripts/seed-flipbooks.mjs
 * Requires DATABASE_URL env var (or .env.local).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

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

const byPath = new Map();
for (const r of records) {
  if (r.kind === "flipbook") byPath.set(r.path, r);
}
const flipbooks = [...byPath.values()];
console.log(`Found ${flipbooks.length} flipbook record(s) to upsert.`);

const rows = flipbooks.map((r) => ({
  language: r.language,
  slug: r.path.slice(1),
  path: r.path,
  title: r.title ?? "",
  description: r.excerpt ?? "",
  pdf_path: r.sourceUrl ?? "",
  published_at: r.date ? new Date(r.date) : null,
  updated_at: r.modified ? new Date(r.modified) : new Date(),
}));

const BATCH = 200;
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  await sql`
    INSERT INTO flipbooks ${sql(chunk)}
    ON CONFLICT (path) DO UPDATE SET
      language     = EXCLUDED.language,
      slug         = EXCLUDED.slug,
      title        = EXCLUDED.title,
      description  = EXCLUDED.description,
      pdf_path     = EXCLUDED.pdf_path,
      published_at = EXCLUDED.published_at,
      updated_at   = EXCLUDED.updated_at`;
}

console.log(`Done — ${rows.length} flipbook(s) upserted.`);
await sql.end();
