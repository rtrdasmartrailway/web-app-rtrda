import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const r = await p.contentRecord.findUnique({
  where: { id: "th-page-442" },
  select: { contentHtml: true },
});
console.log("===HTML_START===");
console.log(r.contentHtml);
console.log("===HTML_END===");
await p.$disconnect();
