import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const path = "/ผลงานและโครงการเด่น/ยุทธศาสตร์-เทคโนโลยี-ระบ";
const r = await p.contentRecord.findUnique({ where: { path } });
if (!r) {
  console.log("NOT FOUND");
  process.exit(1);
}

// Backup
await p.siteMeta.upsert({
  where: { key: "yt_excerpt_backup_v1_th" },
  update: { value: r.excerpt || "" },
  create: { key: "yt_excerpt_backup_v1_th", value: r.excerpt || "" },
});

console.log("Path:", r.path);
console.log("Title:", r.title);
console.log("Old excerpt (first 200):", r.excerpt?.slice(0, 200));

await p.contentRecord.update({
  where: { path },
  data: { excerpt: "", modified: new Date().toISOString() },
});

console.log("EXCERPT CLEARED");

await p.$disconnect();
