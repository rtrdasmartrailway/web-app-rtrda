import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const path = "/เกี่ยวกับ-สทร/ความเป็นมา";
const r = await p.contentRecord.findUnique({ where: { path } });
if (!r) {
  console.log("NOT FOUND");
  process.exit(1);
}

// Backup
await p.siteMeta.upsert({
  where: { key: "kwp_excerpt_backup_v1_th" },
  update: { value: r.excerpt || "" },
  create: { key: "kwp_excerpt_backup_v1_th", value: r.excerpt || "" },
});

await p.contentRecord.update({
  where: { path },
  data: { excerpt: "", modified: new Date().toISOString() },
});

console.log("EXCERPT CLEARED");
console.log("Old:", r.excerpt);

await p.$disconnect();
