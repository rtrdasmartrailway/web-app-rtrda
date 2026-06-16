// Refactor th-page-418: 1 section "ผลงานปัจจุบัน" with 2 sub-headings (1, 2) + 3 figures gallery
import { prisma } from "@/lib/db/client";

const PATH = "/ผลงานและโครงการเด่น/พัฒนา-บุคลากร-ระบบราง";

const r = await prisma.contentRecord.findUnique({ where: { path: PATH } });
if (!r) {
  console.log("NOT FOUND");
  process.exit(1);
}

const html = r.contentHtml;

// === Step 1: Find boundaries ===
const h3Start = html.lastIndexOf("<h3", html.indexOf("ผลงานปัจจุบัน"));
let endPos = html.length;
for (const m of html.matchAll(/<h3\b/g)) {
  if (m.index > h3Start) {
    endPos = m.index;
    break;
  }
}
const prefix = html.slice(0, h3Start);
const oldSection = html.slice(h3Start, endPos);
const suffix = html.slice(endPos);

// === Step 2: Extract ol intros + figures ===
// Find all <ol>...</ol> (1 ol in this section with 2 li)
const olMatches = [...oldSection.matchAll(/<ol\b[^>]*>([\s\S]*?)<\/ol>/g)];

const activities = [];
for (const ol of olMatches) {
  const lis = [...ol[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)];
  for (const li of lis) {
    const intro = li[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    activities.push(intro);
  }
}

// Extract all figures in the section (use position-based — all figures come after ol)
const figureMatches = [...oldSection.matchAll(/<figure\b[^>]*>[\s\S]*?<\/figure>/g)];
const figures = figureMatches
  .map((m) => {
    const figBody = m[0];
    const imgMatch = figBody.match(/<img[^>]*\bsrc="([^"]+)"/);
    if (!imgMatch) return null;
    return imgMatch[1].startsWith("http")
      ? imgMatch[1]
      : `https://www.rtrda.or.th${imgMatch[1].startsWith("/") ? "" : "/"}${imgMatch[1]}`;
  })
  .filter(Boolean);

console.log(
  `=== Extracted: ${activities.length} activities, ${figures.length} figures ===`,
);
for (let i = 0; i < activities.length; i++) {
  console.log(`  Activity ${i + 1}: "${activities[i].slice(0, 60)}..."`);
}
for (const f of figures) {
  console.log(`  Figure: ${f.split("/").pop()}`);
}

// === Step 3: Build new contentHtml ===
const newSectionParts = [
  '<h3 class="wp-block-heading"><strong>ผลงานปัจจุบัน</strong></h3>',
];
newSectionParts.push('\n\n<div class="wijai-current">');

activities.forEach((activity, i) => {
  newSectionParts.push(`\n  <section class="wijai-item">`);
  newSectionParts.push(`\n    <h4 class="yutth-title">${i + 1}. ${activity}</h4>`);
  newSectionParts.push(`\n  </section>`);
});
if (figures.length > 0) {
  newSectionParts.push(`\n  <section class="wijai-item">`);
  newSectionParts.push(`\n    <h4 class="yutth-title">ภาพประกอบการดำเนินงาน</h4>`);
  newSectionParts.push(`\n    <div class="yutth-gallery yutth-gallery-3col">`);
  for (const src of figures) {
    newSectionParts.push(
      `\n      <figure><img loading="lazy" decoding="async" src="${src}" data-lightbox="yutth" alt="" /></figure>`,
    );
  }
  newSectionParts.push(`\n    </div>`);
  newSectionParts.push(`\n  </section>`);
}

newSectionParts.push("\n</div>");
const newSection = newSectionParts.join("");
const newContentHtml = prefix + newSection + suffix;
console.log(
  `\nNew contentHtml: ${newContentHtml.length} chars (vs original ${html.length})`,
);

// === Step 4: Backup + UPDATE ===
await prisma.siteMeta.upsert({
  where: { key: "personnel-content-backup" },
  create: { key: "personnel-content-backup", value: html },
  update: { value: html },
});
await prisma.siteMeta.upsert({
  where: { key: "personnel-excerpt-backup" },
  create: { key: "personnel-excerpt-backup", value: r.excerpt },
  update: { value: r.excerpt },
});

await prisma.contentRecord.update({
  where: { path: PATH },
  data: { excerpt: "", contentHtml: newContentHtml },
});

// === Step 5: Verify ===
const r2 = await prisma.contentRecord.findUnique({ where: { path: PATH } });
console.log(`\n=== After UPDATE ===`);
console.log(`  excerpt.len: ${r2.excerpt.length}`);
console.log(`  contentHtml.len: ${r2.contentHtml.length}`);
console.log(`  has wijai-item: ${r2.contentHtml.includes("wijai-item")}`);
console.log(`  has yutth-title: ${r2.contentHtml.includes("yutth-title")}`);
console.log(`  has yutth-gallery-3col: ${r2.contentHtml.includes("yutth-gallery-3col")}`);
console.log(`  has data-lightbox: ${r2.contentHtml.includes("data-lightbox")}`);
console.log(`  h4 count: ${(r2.contentHtml.match(/<h4\b/g) || []).length}`);
console.log(`  figures: ${(r2.contentHtml.match(/<figure\b/g) || []).length}`);
console.log(`  imgs: ${(r2.contentHtml.match(/<img\b/g) || []).length}`);
console.log(
  `  imgs absolute: ${(r2.contentHtml.match(/src="https:\/\//g) || []).length}`,
);

await prisma.$disconnect();
