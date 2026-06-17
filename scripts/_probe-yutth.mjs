import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const r = await p.contentRecord.findFirst({
  where: { path: { contains: "ยุทธศาสตร์เทคโนโลยี" }, language: "th" },
  select: { id: true, path: true, title: true, language: true, contentHtml: true },
});
if (!r) {
  console.error("not found");
  process.exit(1);
}
console.log("PATH:", r.path);
console.log("TITLE:", r.title);
console.log("LANG:", r.language);
console.log("LENGTH:", r.contentHtml.length);
console.log("---");
// Extract image src list
const imgs = [...r.contentHtml.matchAll(/<img[^>]*src="([^"]+)"/g)].map((m) => m[1]);
console.log("IMAGES:");
imgs.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
// Extract h1/h2/h3 headings
const heads = [...r.contentHtml.matchAll(/<h([1-3])[^>]*>(.*?)<\/h\1>/g)].map(
  (m) => `h${m[1]}: ${m[2].replace(/<[^>]+>/g, "").trim()}`,
);
console.log("HEADINGS:");
heads.forEach((h, i) => console.log(`  ${i + 1}. ${h}`));
await p.$disconnect();
