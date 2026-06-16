// Check th-page-416 (มาตรฐานและระบบทดสอบ) structure
import { prisma } from "@/lib/db/client";

const r = await prisma.contentRecord.findUnique({
  where: { path: "/ผลงานและโครงการเด่น/มาตรฐาน-ระบบทดสอบ" },
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
console.log(``);
console.log(`has wijai-item: ${r.contentHtml.includes("wijai-item")}`);
console.log(`has yutth-title: ${r.contentHtml.includes("yutth-title")}`);
console.log(`has yutth-gallery: ${r.contentHtml.includes("yutth-gallery")}`);
console.log(`has data-lightbox: ${r.contentHtml.includes("data-lightbox")}`);
const figCount = (r.contentHtml.match(/<figure\b/g) || []).length;
const imgCount = (r.contentHtml.match(/<img\b/g) || []).length;
console.log(`figures: ${figCount}, imgs: ${imgCount}`);
const h3Count = (r.contentHtml.match(/<h3\b/g) || []).length;
const h4Count = (r.contentHtml.match(/<h4\b/g) || []).length;
console.log(`h3: ${h3Count}, h4: ${h4Count}`);

// Find h3 positions
const h3s = [...r.contentHtml.matchAll(/<h3[^>]*>(.*?)<\/h3>/g)].map((m) =>
  m[1].slice(0, 50),
);
console.log(`h3 list:`);
h3s.forEach((h, i) => console.log(`  [${i}] ${h}`));

// Find h3-ผลงานปัจจุบัน section
const idx = r.contentHtml.indexOf("ผลงานปัจจุบัน");
if (idx > 0) {
  console.log(``);
  console.log(`h3-ผลงานปัจจุบัน at idx: ${idx}`);
  console.log(`snippet[${idx}..${idx + 600}]:`);
  console.log(r.contentHtml.slice(idx, idx + 600));
}

await prisma.$disconnect();
