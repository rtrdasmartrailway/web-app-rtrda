// Move .vision-number from BEFORE .vision-title to AFTER .vision-title
import { readFileSync, writeFileSync } from "fs";
import pg from "/srv/workspace/web-app-rtrda/node_modules/pg/lib/index.js";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const r = await c.query('SELECT "contentHtml" FROM "ContentRecord" WHERE id = $1', [
  "th-page-396",
]);
let html = r.rows[0].contentHtml;
const before = html;

// Pattern: <div class="vision-number">NN</div>\n    <h3 class="vision-title">TITLE</h3>
// Replace with:  <h3 class="vision-title">TITLE</h3>\n    <div class="vision-number">NN</div>

const re =
  /(<div class="vision-number">(\d+)<\/div>\s*<h3 class="vision-title">([^<]+)<\/h3>)/g;
let moved = 0;
html = html.replace(re, (_, whole, num, title) => {
  moved++;
  return `<h3 class="vision-title">${title}</h3>\n    <div class="vision-number">${num}</div>`;
});

console.log(`Moved ${moved} number blocks from above to below title`);
console.log(`OLD: ${before.length} chars | NEW: ${html.length} chars`);

const r2 = await c.query(
  'UPDATE "ContentRecord" SET "contentHtml" = $1 WHERE id = $2 RETURNING id',
  [html, "th-page-396"],
);
console.log("Updated:", r2.rows.length, "rows");

// Save preview
writeFileSync("/tmp/vision-moved.html", html);

await c.end();
