import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const PATH = "/เกี่ยวกับ-สทร/ค่านิยมองค์กร";

// Backup first
const cur = await p.contentRecord.findUnique({ where: { path: PATH } });
if (!cur) { console.error("Page not found"); process.exit(1); }

await p.siteMeta.upsert({
  where: { key: "values_letters_pre_v1" },
  create: { key: "values_letters_pre_v1", value: cur.contentHtml },
  update: { value: cur.contentHtml },
});
console.log("Backup saved (values_letters_pre_v1)");

// Build new content — prepend the letters banner before the existing columns
const LETTERS_BANNER = `<div class="values-letters"><span class="vl-letter">R</span><span class="vl-letter">T</span><span class="vl-letter">R</span><span class="vl-letter">D</span><span class="vl-letter">A</span></div>`;

let html = cur.contentHtml;
// Skip if already added
if (html.includes("values-letters")) {
  console.log("Already has values-letters — removing old one and re-prepending");
  html = html.replace(/<div class="values-letters">[\s\S]*?<\/div>\s*/, "");
}
const newHtml = LETTERS_BANNER + "\n" + html;

await p.contentRecord.update({
  where: { path: PATH },
  data: { contentHtml: newHtml },
});
console.log("DB updated. New HTML length:", newHtml.length);

await p.$disconnect();
