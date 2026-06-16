// Find by path/title pattern
import { prisma } from "@/lib/db/client";

const records = await prisma.contentRecord.findMany({
  where: {
    OR: [
      { path: { contains: "ฐานข้อมูล" } },
      { title: { contains: "ฐานข้อมูลเทคโนโลยี" } },
    ],
  },
});

console.log(`=== Records (${records.length}) ===`);
for (const r of records) {
  console.log(`  id: ${r.id}`);
  console.log(`  path: ${r.path}`);
  console.log(`  title: ${r.title}`);
  console.log(`  excerpt.len: ${r.excerpt.length}`);
  console.log(`  contentHtml.len: ${r.contentHtml.length}`);
  console.log(``);
}

await prisma.$disconnect();
