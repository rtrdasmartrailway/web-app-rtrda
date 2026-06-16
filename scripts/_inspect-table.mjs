import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const rec = await p.contentRecord.findUnique({
  where: { id: "th-page-442" },
  select: { id: true, path: true, contentHtml: true, excerpt: true },
});
console.log("LEN:", rec.contentHtml.length);
console.log("=== HEAD ===");
console.log(rec.contentHtml.slice(0, 2500));
console.log("=== EXCERPT ===");
console.log(rec.excerpt?.slice(0, 200));
await p.$disconnect();
