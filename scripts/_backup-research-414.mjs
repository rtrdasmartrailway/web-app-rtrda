import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const r = await p.contentRecord.findUnique({
  where: { path: "/ผลงานและโครงการเด่น/วิจัย-นวัตกรรม" },
});
if (!r) {
  console.error("not found");
  process.exit(1);
}
await p.siteMeta.upsert({
  where: { key: "research414_content_backup_v1_th" },
  update: { value: r.contentHtml },
  create: { key: "research414_content_backup_v1_th", value: r.contentHtml },
});
console.log("BACKED UP. length:", r.contentHtml.length);
await p.$disconnect();
