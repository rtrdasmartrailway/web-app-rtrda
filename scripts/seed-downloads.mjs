#!/usr/bin/env node
/**
 * Seed the `downloads` table from wp-content.json downloads.
 * Keeps the WordPress download id (the /sdc_download/[id] route depends on it).
 *
 * Run with: node scripts/seed-downloads.mjs
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
const { downloads = [] } = JSON.parse(await readFile(manifestPath, "utf8"));
console.log(`Found ${downloads.length} download(s) to upsert.`);

const rows = downloads.map((d) => ({
  id: String(d.id),
  source_url: d.sourceUrl ?? "",
  local_path: d.localPath ?? "",
  file_name: d.fileName ?? "",
  mime_type: d.mimeType ?? "",
  size_bytes: d.sizeBytes ?? 0,
  title: d.title ?? "",
  group_name: d.group ?? "",
  source_pages: sql.json(d.sourcePages ?? []),
}));

if (rows.length > 0) {
  await sql`
    INSERT INTO downloads ${sql(rows)}
    ON CONFLICT (id) DO UPDATE SET
      source_url   = EXCLUDED.source_url,
      local_path   = EXCLUDED.local_path,
      file_name    = EXCLUDED.file_name,
      mime_type    = EXCLUDED.mime_type,
      size_bytes   = EXCLUDED.size_bytes,
      title        = EXCLUDED.title,
      group_name   = EXCLUDED.group_name,
      source_pages = EXCLUDED.source_pages`;
}

console.log(`Done — ${rows.length} download(s) upserted.`);
await sql.end();
