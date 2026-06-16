import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const rows = await p.contentRecord.findMany({
  select: { id: true, contentHtml: true },
});
for (const r of rows) console.log("DB|" + r.id + "|" + r.contentHtml.length);
await p.$disconnect();
