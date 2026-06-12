#!/usr/bin/env node
/**
 * Seed news table from all post records in wp-content.json.
 * Run with: node scripts/seed-news.mjs
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

const CATEGORY_MAP = {
  7: "ข่าวและกิจกรรม",
  150: "ประกาศ",
  6: "บทความ",
  20: "ความร่วมมือ",
};

const manifestPath = path.join(root, "src/data/wp-content.json");
console.log("Reading wp-content.json…");
const { records } = JSON.parse(await readFile(manifestPath, "utf8"));

const posts = records.filter((r) => r.kind === "post");
console.log(`Found ${posts.length} post record(s) to upsert.`);

let count = 0;
for (const r of posts) {
  const slug = r.path.slice(1); // strip leading "/"
  const catId = r.categoryIds?.[0] ?? null;
  const category = CATEGORY_MAP[catId] ?? "";

  await sql`
    INSERT INTO news
      (language, slug, title, excerpt, body, category,
       featured_image_id, attachments, published_at, updated_at)
    VALUES (
      ${r.language},
      ${slug},
      ${r.title},
      ${r.excerpt ?? ""},
      ${r.contentHtml ?? ""},
      ${category},
      ${null},
      ${"[]"},
      ${r.date ? new Date(r.date) : null},
      ${r.modified ? new Date(r.modified) : new Date()}
    )
    ON CONFLICT (slug) DO UPDATE SET
      title        = EXCLUDED.title,
      excerpt      = EXCLUDED.excerpt,
      body         = EXCLUDED.body,
      category     = EXCLUDED.category,
      published_at = EXCLUDED.published_at,
      updated_at   = EXCLUDED.updated_at
  `;
  count++;
  if (count % 50 === 0) process.stdout.write(`  ${count}/${posts.length}\r`);
}

console.log(`\nDone — ${count} record(s) upserted.`);
await sql.end();
