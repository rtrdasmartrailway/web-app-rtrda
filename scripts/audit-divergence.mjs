// scripts/audit-divergence.mjs
//
// Compare the live Postgres ContentRecord table against the frozen
// `src/data/wp-content.json` source of truth, *after* applying the same
// `stripImportedChrome` transform that `npm run db:seed` runs.
//
// Why this matters: every CI deploy runs `npm run db:seed` which TRUNCATEs
// ContentRecord and re-inserts from wp-content.json. If you edit the DB
// directly without mirroring to wp-content.json, the next deploy will
// silently revert that edit. This script makes that divergence visible.
//
// Usage:
//   npm run audit:divergence
//
// Exit codes:
//   0 = all DB records match sanitize(WP) — safe to deploy
//   1 = divergent records found — fix before committing
//   2 = structural mismatch (records only in one side)

import "dotenv/config";
import fs from "node:fs";
import pg from "pg";
import { stripImportedChrome } from "./import-wordpress-sanitize.mjs";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const wpRaw = JSON.parse(fs.readFileSync("src/data/wp-content.json", "utf-8"));
const wpById = new Map();
for (const r of wpRaw.records) wpById.set(r.id, r);

const { rows: dbRows } = await client.query(
  'SELECT id, "contentHtml" FROM "ContentRecord"',
);
const dbById = new Map();
for (const r of dbRows) dbById.set(r.id, r.contentHtml);

let identical = 0;
const divergent = [];
const onlyInDb = [];
const onlyInWp = [];

for (const [id, wpRec] of wpById) {
  if (!dbById.has(id)) {
    onlyInWp.push(id);
    continue;
  }
  const expected = stripImportedChrome(wpRec.contentHtml);
  const actual = dbById.get(id);
  if (expected === actual) {
    identical++;
  } else {
    divergent.push({
      id,
      wpRaw: wpRec.contentHtml.length,
      wpSan: expected.length,
      db: actual.length,
      delta: actual.length - expected.length,
    });
  }
}
for (const id of dbById.keys()) {
  if (!wpById.has(id)) onlyInDb.push(id);
}

await client.end();

console.log(`WP records:      ${wpById.size}`);
console.log(`DB records:      ${dbById.size}`);
console.log(`Identical:       ${identical}`);
console.log(`Divergent:       ${divergent.length}`);
console.log(
  `Only in DB:      ${onlyInDb.length}${onlyInDb.length ? " " + JSON.stringify(onlyInDb) : ""}`,
);
console.log(
  `Only in WP:      ${onlyInWp.length}${onlyInWp.length ? " " + JSON.stringify(onlyInWp) : ""}`,
);
console.log("");

if (divergent.length) {
  console.log("=== DIVERGENT RECORDS (DB != sanitize(WP)) ===");
  console.log("These are silently overwritten by the next `npm run db:seed`.");
  console.log("Either revert the DB change or update src/data/wp-content.json to match.");
  console.log("");
  for (const d of divergent) {
    const sign = d.delta >= 0 ? "+" : "";
    console.log(
      `  ${d.id}: WP_raw=${d.wpRaw}, WP_san=${d.wpSan}, DB=${d.db}, Δ=${sign}${d.delta}`,
    );
  }
  console.log("");
  process.exit(1);
}

if (onlyInDb.length) {
  console.log(
    "Records exist in DB but not in wp-content.json — they will be deleted on next seed.",
  );
  process.exit(2);
}

console.log("✅ DB ↔ wp-content.json in sync. Safe to deploy.");
