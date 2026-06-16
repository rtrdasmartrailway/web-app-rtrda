// เอา eyebrow pill (gradient #003471 → #0066b3, border-radius:20px) ออกจากหน้า "วิสัยทัศน์"
// ทั้ง TH + EN — ปรับให้ใช้ heading style เดิมของ theme

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const oldTh = await p.contentRecord.findUnique({
  where: { path: "/เกี่ยวกับ-สทร/วิสัยทัศน์-พันธกิจ" },
});
const oldEn = await p.contentRecord.findUnique({
  where: { path: "/en/เกี่ยวกับ-สทร/วิสัยทัศน์-พันธกิจ" },
});

// backup v6
await p.siteMeta.upsert({
  where: { key: "vision_backup_v6_th" },
  update: { value: oldTh.contentHtml },
  create: { key: "vision_backup_v6_th", value: oldTh.contentHtml },
});
await p.siteMeta.upsert({
  where: { key: "vision_backup_v6_en" },
  update: { value: oldEn.contentHtml },
  create: { key: "vision_backup_v6_en", value: oldEn.contentHtml },
});

// ลบ eyebrow pill block (gradient pill ที่ขึ้นต้นด้วย border-radius:20px)
// pattern: <div style="text-align:center; margin:0 0 16px;"> <div style="display:inline-block; padding:4px 14px; background:linear-gradient(90deg, #003471 0%, #0066b3 100%); ...
function removeEyebrow(html) {
  // ลบทั้ง block eyebrow (ทั้ง wrapper div และ pill div)
  return html.replace(
    /<div style="text-align:center; margin:0 0 16px;">\s*<div style="display:inline-block; padding:4px 14px; background:linear-gradient\(90deg, #003471 0%, #0066b3 100%\);[^"]+">[^<]+<\/div>\s*<\/div>/g,
    "",
  );
}

const newTh = removeEyebrow(oldTh.contentHtml);
const newEn = removeEyebrow(oldEn.contentHtml);

console.log(
  "TH: before",
  oldTh.contentHtml.length,
  "after",
  newTh.length,
  "removed",
  oldTh.contentHtml.length - newTh.length,
);
console.log(
  "EN: before",
  oldEn.contentHtml.length,
  "after",
  newEn.length,
  "removed",
  oldEn.contentHtml.length - newEn.length,
);
console.log("TH still has eyebrow:", newTh.includes("border-radius:20px"));
console.log("EN still has eyebrow:", newEn.includes("border-radius:20px"));

await p.contentRecord.update({
  where: { path: "/เกี่ยวกับ-สทร/วิสัยทัศน์-พันธกิจ" },
  data: { contentHtml: newTh, modified: new Date().toISOString() },
});
await p.contentRecord.update({
  where: { path: "/en/เกี่ยวกับ-สทร/วิสัยทัศน์-พันธกิจ" },
  data: { contentHtml: newEn, modified: new Date().toISOString() },
});

console.log("UPDATED TH + EN — eyebrow pill removed");
console.log("Backup v6 saved");

await p.$disconnect();
