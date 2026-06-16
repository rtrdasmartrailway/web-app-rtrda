// Find by path pattern
import { prisma } from "@/lib/db/client";

const records = await prisma.contentRecord.findMany({
  where: { path: { contains: "ถ่ายทอด" } },
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
