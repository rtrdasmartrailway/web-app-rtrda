import { prisma } from "@/lib/db/client";

// Find by path pattern
const records = await prisma.contentRecord.findMany({
  where: { path: { contains: "category" } },
});
console.log(`=== Records with 'category' in path (${records.length}) ===`);
for (const r of records) {
  console.log(
    `  ${r.id} | ${r.path} | ${r.title} (excerpt=${r.excerpt.length}, html=${r.contentHtml.length})`,
  );
}

// Try by path
const tryPaths = [
  "/category/ข่าวและกิจกรรม",
  "/category/ข่าวและกิจกรรม/",
  "/category/ข-่าวและกิจกรรม",
  "/category/ข-าวและก-ิจกรรม",
];
console.log("");
console.log("=== Try direct path lookup ===");
for (const p of tryPaths) {
  const r = await prisma.contentRecord.findUnique({ where: { path: p } });
  console.log(`  ${p}: ${r ? "FOUND" : "NOT FOUND"}`);
}

// List ALL records
console.log("");
console.log("=== ALL records (first 30) ===");
const all = await prisma.contentRecord.findMany({
  orderBy: { path: "asc" },
  take: 30,
});
for (const r of all) {
  console.log(`  ${r.id} | ${r.path} | ${r.title}`);
}

await prisma.$disconnect();
