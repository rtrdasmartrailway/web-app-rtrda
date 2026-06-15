#!/usr/bin/env node
/**
 * Seed the `media` registry from wp-content.json media assets.
 * Inserts with EXPLICIT ids (= the WordPress media id) so that
 * featured_image_id / cover_image_id / logo_image_id references on other content
 * resolve, then resets the serial sequence. Run first (other seeds FK into it).
 *
 * Run with: node scripts/seed-media.mjs
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
const { media = [] } = JSON.parse(await readFile(manifestPath, "utf8"));

// Keep only assets with a valid numeric id, deduped (last wins).
const byId = new Map();
for (const m of media) {
  const id = Number(m.id);
  if (!Number.isInteger(id) || id <= 0) continue;
  byId.set(id, m);
}
const rows = [...byId.entries()].map(([id, m]) => ({
  id,
  filename: m.title || path.basename(m.localPath ?? "") || String(id),
  file_path: m.localPath ?? "",
  mime_type: m.mimeType ?? "",
  size_bytes: null,
  width: m.width ?? null,
  height: m.height ?? null,
  alt_text: m.alt ?? "",
}));

console.log(`Seeding ${rows.length} media asset(s)…`);
const BATCH = 500;
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  await sql`
    INSERT INTO media ${sql(chunk)}
    ON CONFLICT (id) DO UPDATE SET
      filename  = EXCLUDED.filename,
      file_path = EXCLUDED.file_path,
      mime_type = EXCLUDED.mime_type,
      width     = EXCLUDED.width,
      height    = EXCLUDED.height,
      alt_text  = EXCLUDED.alt_text`;
  process.stdout.write(`  ${Math.min(i + BATCH, rows.length)}/${rows.length}\r`);
}

// Keep the serial sequence ahead of the explicit ids we inserted.
await sql`SELECT setval(pg_get_serial_sequence('media', 'id'), COALESCE((SELECT MAX(id) FROM media), 1))`;

console.log(`\nDone — ${rows.length} media row(s) upserted.`);
await sql.end();
