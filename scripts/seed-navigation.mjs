#!/usr/bin/env node
/**
 * Seed the `navigation` table (flattened tree) and `site_meta` (generatedAt /
 * source) from wp-content.json. Clears navigation first for idempotency.
 *
 * Run with: node scripts/seed-navigation.mjs
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
const { navigation = {}, generatedAt, source } = JSON.parse(await readFile(manifestPath, "utf8"));

function flattenNav(items, language, parentId, startOrder) {
  const rows = [];
  let order = startOrder;
  for (const item of items ?? []) {
    rows.push({
      language,
      label: item.label ?? "",
      href: item.href ?? "",
      path: item.path ?? null,
      external: item.external ?? false,
      parent_id: parentId,
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

console.log(`Seeding ${navRows.length} navigation row(s)…`);
await sql`DELETE FROM navigation`;
if (navRows.length > 0) {
  await sql`INSERT INTO navigation ${sql(navRows)}`;
}

console.log("Seeding site_meta…");
await sql`
  INSERT INTO site_meta (key, value)
  VALUES ('generatedAt', ${generatedAt ?? ""}), ('source', ${source ?? ""})
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;

console.log(`Done — navigation: ${navRows.length} rows, site_meta: 2 keys.`);
await sql.end();
