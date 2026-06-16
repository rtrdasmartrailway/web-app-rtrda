import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const path = "/เกี่ยวกับ-สทร/ความเป็นมา";
const r = await p.contentRecord.findUnique({ where: { path } });
if (!r) {
  console.log("NOT FOUND:", path);
  process.exit(1);
}

// Backup fresh
await p.siteMeta.upsert({
  where: { key: "kwp_backup_v2_th" },
  update: { value: r.contentHtml },
  create: { key: "kwp_backup_v2_th", value: r.contentHtml },
});

let html = r.contentHtml;

// Match the first column (strategy-1.png with ยุทธศาสตร์ชาติระยะ 20 ปี)
// From "<div class="wp-block-column...>" opening the strategy column
// To the closing </div> of that column
const strategyRe = new RegExp(
  '<div class="wp-block-column is-vertically-aligned-top is-layout-flow wp-block-column-is-layout-flow">' +
    '\\s*<figure class="wp-block-image size-full"><img[^>]*src="/wp-content/uploads/2023/02/strategy-1.png"[^>]*></figure>' +
    "\\s*<p>[^<]*ยุทธศาสตร์ชาติระยะ 20 ปี[^<]*</p>" +
    "\\s*</div>",
  "s",
);

const match = html.match(strategyRe);
if (!match) {
  console.log("STRATEGY COLUMN NOT MATCHED");
  console.log("Looking for pattern in HTML...");
  if (html.includes("strategy-1.png")) {
    console.log("  - strategy-1.png exists");
  } else {
    console.log("  - strategy-1.png NOT found");
  }
  if (html.includes("ยุทธศาสตร์ชาติระยะ 20 ปี")) {
    console.log("  - ยุทธศาสตร์ชาติระยะ 20 ปี text exists");
  } else {
    console.log("  - text NOT found");
  }
  process.exit(1);
}

console.log("MATCHED strategy column, length:", match[0].length);
const newHtml = html.replace(strategyRe, "");

console.log("Original length:", html.length);
console.log("New length:", newHtml.length);
console.log("Removed:", html.length - newHtml.length, "chars");

await p.contentRecord.update({
  where: { path },
  data: { contentHtml: newHtml, modified: new Date().toISOString() },
});

console.log("UPDATED TH v2 — removed ยุทธศาสตร์ชาติ column");

await p.$disconnect();
