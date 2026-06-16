import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const r = await p.contentRecord.findUnique({
  where: { path: "/เกี่ยวกับ-สทร/ความเป็นมา" },
});
console.log("Excerpt:", JSON.stringify(r.excerpt));
console.log("Title:", r.title);
await p.$disconnect();
