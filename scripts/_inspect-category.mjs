import { prisma } from "@/lib/db/client";

const r = await prisma.contentRecord.findUnique({
  where: { path: "/category/ข่าวและกิจกรรม" },
});
if (!r) {
  console.log("NOT FOUND");
  process.exit(1);
}
console.log(`id: ${r.id}`);
console.log(`path: ${r.path}`);
console.log(`title: ${r.title}`);
console.log(`excerpt.len: ${r.excerpt.length}`);
console.log(`contentHtml.len: ${r.contentHtml.length}`);
console.log(`language: ${r.language}`);
console.log(`kind: ${r.kind}`);
console.log(``);
console.log(`=== contentHtml (first 5000 chars) ===`);
console.log(r.contentHtml.slice(0, 5000));

await prisma.$disconnect();
