import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const r = await p.contentRecord.findUnique({
  where: { path: "/คลังความรู้" },
  select: { contentHtml: true },
});
// Find all image src attributes
const imgs = [...r.contentHtml.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
console.log("TOTAL IMG SRCS:", imgs.length);
for (const src of imgs.slice(0, 15)) console.log(" -", src);
console.log("---");
// Find all <a> download links
const links = [...r.contentHtml.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]*)/g)];
const downloads = links.filter(([, , t]) => /ดาวน์โหลด|อ่าน/.test(t));
console.log("DOWNLOAD/READ LINKS:", downloads.length);
for (const [full, href, text] of downloads.slice(0, 10))
  console.log(" -", text.trim(), "|", href);
await p.$disconnect();
