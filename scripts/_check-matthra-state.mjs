// Check current state of th-page-415 (มาตรฐานระบบราง) and th-page-414 (วิจัยและพัฒนา)
// Uses project's prisma client at @/lib/db/client
import { prisma } from "@/lib/db/client";

const targets = [
  { path: "/ผลงานและโครงการเด่น/มาตรฐาน-ระบบราง", slug: "th-page-415" },
  { path: "/ผลงานและโครงการเด่น/วิจัย-นวัตกรรม", slug: "th-page-414" },
];

for (const t of targets) {
  const r = await prisma.contentRecord.findUnique({ where: { path: t.path } });
  if (!r) {
    console.log(`${t.slug} NOT FOUND`);
    continue;
  }
  console.log(`=== ${t.slug} (${t.path}) ===`);
  console.log(`  title: ${r.title}`);
  console.log(`  excerpt.len: ${r.excerpt.length}`);
  console.log(`  excerpt.preview: ${r.excerpt.slice(0, 80).replace(/\n/g, " ")}`);
  console.log(`  contentHtml.len: ${r.contentHtml.length}`);
  console.log(`  has wijai-item: ${r.contentHtml.includes("wijai-item")}`);
  console.log(`  has yutth-title: ${r.contentHtml.includes("yutth-title")}`);
  console.log(`  has yutth-gallery: ${r.contentHtml.includes("yutth-gallery")}`);
  console.log(`  has data-lightbox: ${r.contentHtml.includes("data-lightbox")}`);
  const figCount = (r.contentHtml.match(/<figure\b/g) || []).length;
  const imgCount = (r.contentHtml.match(/<img\b/g) || []).length;
  console.log(`  figures: ${figCount}, imgs: ${imgCount}`);
  const h4Count = (r.contentHtml.match(/<h4\b/g) || []).length;
  console.log(`  h4 count: ${h4Count}`);
  const idx = r.contentHtml.indexOf("ผลงานปัจจุบัน");
  if (idx > 0) {
    console.log(`  h3-ผลงานปัจจุบัน at idx: ${idx}`);
    console.log(`  snippet[${idx}..${idx + 600}]:`);
    console.log(`    ${r.contentHtml.slice(idx, idx + 600).replace(/\n/g, " ")}`);
  } else {
    console.log(`  h3-ผลงานปัจจุบัน: NOT FOUND`);
  }
  console.log(``);
}

await prisma.$disconnect();
