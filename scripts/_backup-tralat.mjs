import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const r = await p.contentRecord.findFirst({
  where: { title: { contains: "ตราสัญลักษณ์" }, language: "th" },
});
if (!r) {
  console.error("not found");
  process.exit(1);
}
await p.siteMeta.upsert({
  where: { key: "tralat_content_backup_v1_th" },
  update: { value: r.contentHtml },
  create: { key: "tralat_content_backup_v1_th", value: r.contentHtml },
});
await p.siteMeta.upsert({
  where: { key: "tralat_excerpt_backup_v1_th" },
  update: { value: r.excerpt || "" },
  create: { key: "tralat_excerpt_backup_v1_th", value: r.excerpt || "" },
});
console.log("BACKED UP. length:", r.contentHtml?.length);
console.log("PATH:", r.path);
await p.$disconnect();
