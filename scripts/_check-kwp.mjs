import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const r = await p.contentRecord.findUnique({
  where: { path: "/เกี่ยวกับ-สทร/ความเป็นมา" },
});
console.log("Has strategy-1.png?", r.contentHtml.includes("strategy-1.png"));
console.log("Has ยุทธศาสตร์ชาติ?", r.contentHtml.includes("ยุทธศาสตร์ระยะ 20 ปี"));
console.log("LEN:", r.contentHtml.length);
await p.$disconnect();
