import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
// Try several possible paths
const candidates = await p.contentRecord.findMany({
  where: { title: { contains: "วิจัย" }, language: "th" },
  select: { id: true, path: true, title: true, language: true },
});
console.log("TITLE MATCHES:");
for (const r of candidates) console.log(" -", r.path, "|", r.title);
const byPath = await p.contentRecord.findFirst({
  where: { path: { contains: "วิจัย" }, language: "th" },
  select: { id: true, path: true, title: true, contentHtml: true, excerpt: true },
});
console.log("\nCONTENT LENGTH:", byPath?.contentHtml?.length);
console.log("EXCERPT:", byPath?.excerpt?.slice(0, 200));
await p.$disconnect();
