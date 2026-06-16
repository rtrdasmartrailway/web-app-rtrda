import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Revert from backup
const backup = await p.siteMeta.findUnique({ where: { key: "kwp_backup_v1_th" } });
if (!backup) {
  console.log("NO BACKUP");
  process.exit(1);
}

await p.contentRecord.update({
  where: { path: "/เกี่ยวกับ-สทร/ความเป็นมา" },
  data: { contentHtml: backup.value, modified: new Date().toISOString() },
});
console.log("REVERTED from backup");
console.log("Restored length:", backup.value.length);

await p.$disconnect();
