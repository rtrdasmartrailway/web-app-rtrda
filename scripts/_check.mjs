import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const r = await p.contentRecord.findUnique({
  where: { path: "/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร" },
});
console.log("Modified:", r.modified);
console.log("Has vp-oc?", r.contentHtml.includes("vp-oc"));
console.log("Has vp-board-card?", r.contentHtml.includes("vp-board-card"));
console.log("LEN:", r.contentHtml.length);
await p.$disconnect();
