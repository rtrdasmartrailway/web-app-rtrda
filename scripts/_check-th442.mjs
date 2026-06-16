import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const rec = await p.contentRecord.findUnique({
  where: { id: "th-page-442" },
  select: { contentHtml: true, modified: true },
});
console.log("DB th-page-442:");
console.log("  length:", rec.contentHtml.length);
console.log("  modified:", rec.modified);
console.log("  has colgroup:", rec.contentHtml.includes("<colgroup>"));
console.log("  has tbody:", rec.contentHtml.includes("<tbody>"));
console.log("  has hero-excerpt:", rec.contentHtml.includes("hero-excerpt"));
await p.$disconnect();
