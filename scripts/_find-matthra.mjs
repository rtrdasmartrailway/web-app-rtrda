// Find record with title containing "มาตรฐานระบบราง"
import { prisma } from "@/lib/db/client";

const records = await prisma.contentRecord.findMany({
  where: { title: { contains: "มาตรฐานระบบราง" } },
});

console.log("=== Records with title containing 'มาตรฐานระบบราง' ===");
for (const r of records) {
  console.log(`  id: ${r.id}`);
  console.log(`  path: ${r.path}`);
  console.log(`  title: ${r.title}`);
  console.log(`  excerpt.len: ${r.excerpt.length}`);
  console.log(`  contentHtml.len: ${r.contentHtml.length}`);
  console.log(``);
}

// Also list all records in /ผลงานและโครงการเด่น/ for reference
console.log("=== All records under /ผลงานและโครงการเด่น ===");
const all = await prisma.contentRecord.findMany({
  where: { path: { startsWith: "/ผลงานและโครงการเด่น" } },
  orderBy: { path: "asc" },
});
for (const r of all) {
  console.log(
    `  ${r.id} | ${r.path} | ${r.title} (excerpt=${r.excerpt.length}, html=${r.contentHtml.length})`,
  );
}

await prisma.$disconnect();
