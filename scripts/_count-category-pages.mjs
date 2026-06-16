import { prisma } from "@/lib/db/client";

const r = await prisma.contentRecord.findUnique({
  where: { path: "/category/ข่าวและกิจกรรม" },
});
console.log(`Record: ${r.id}`);
console.log(`contentHtml first 500:`);
console.log(r.contentHtml.slice(0, 500));

const r2 = await prisma.contentRecord.findUnique({
  where: { path: "/category/ข่าวและกิจกรรม/page/2" },
});
console.log(``);
console.log(`Page 2: ${r2 ? "FOUND" : "NOT FOUND"}`);
if (r2) {
  const liMatches = [...r2.contentHtml.matchAll(/<li>[\s\S]*?<\/li>/g)];
  console.log(`  li count: ${liMatches.length}`);
}

const all = await prisma.contentRecord.findMany({
  where: { path: { startsWith: "/category/ข่าวและกิจกรรม" } },
  orderBy: { path: "asc" },
});
console.log(``);
console.log(`All category pages (${all.length}):`);
for (const x of all) {
  const liMatches = [...x.contentHtml.matchAll(/<li>[\s\S]*?<\/li>/g)];
  console.log(`  ${x.path} | html=${x.contentHtml.length} | li=${liMatches.length}`);
}

await prisma.$disconnect();
