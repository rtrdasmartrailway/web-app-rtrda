import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const r = await p.contentRecord.findUnique({
  where: { path: "/เกี่ยวกับ-สทร/วิสัยทัศน์-พันธกิจ" },
});
if (!r) {
  console.error("not found");
  process.exit(1);
}
await p.siteMeta.upsert({
  where: { key: "vision396_content_backup_v3_th" },
  update: { value: r.contentHtml },
  create: { key: "vision396_content_backup_v3_th", value: r.contentHtml },
});
await p.siteMeta.upsert({
  where: { key: "vision396_excerpt_backup_v3_th" },
  update: { value: r.excerpt || "" },
  create: { key: "vision396_excerpt_backup_v3_th", value: r.excerpt || "" },
});
console.log("BACKED UP. contentHtml length:", r.contentHtml.length);
await p.$disconnect();
