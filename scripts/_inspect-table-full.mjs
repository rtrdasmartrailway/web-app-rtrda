import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const rec = await p.contentRecord.findUnique({ where: { id: "th-page-442" } });
// Print full
console.log(rec.contentHtml);
await p.$disconnect();
