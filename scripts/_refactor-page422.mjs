// Refactor th-page-422: 3 activities + 1 gallery = 4 sections
import { prisma } from "@/lib/db/client";

const PATH = "/ผลงานและโครงการเด่น/ฐานข้อมูล-เทคโนโลยี-ระบบ";

const r = await prisma.contentRecord.findUnique({ where: { path: PATH } });
if (!r) {
  console.log("NOT FOUND");
  process.exit(1);
}

const html = r.contentHtml;

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

// Extract ol + following figure (position-based pairing)
const olMatches = [...oldSection.matchAll(/<ol\b[^>]*>([\s\S]*?)<\/ol>/g)];
const figureMatches = [...oldSection.matchAll(/<figure\b[^>]*>[\s\S]*?<\/figure>/g)];

const activities = [];
for (let i = 0; i < olMatches.length; i++) {
  const ol = olMatches[i];
  const liText = ol[1].match(/<li[^>]*>([\s\S]*?)<\/li>/)?.[1] || "";
  const intro = liText
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Find figure that comes AFTER this ol but BEFORE next ol
  const nextOlIdx = i + 1 < olMatches.length ? olMatches[i + 1].index : oldSection.length;
  const fig = figureMatches.find((f) => f.index > ol.index && f.index < nextOlIdx);
  let imgsrc = null;
  if (fig) {
    const imgMatch = fig[0].match(/<img[^>]*\bsrc="([^"]+)"/);
    if (imgMatch) {
      imgsrc = imgMatch[1].startsWith("http")
        ? imgMatch[1]
        : `https://www.rtrda.or.th${imgMatch[1].startsWith("/") ? "" : "/"}${imgMatch[1]}`;
    }
  }
  activities.push({ idx: i + 1, intro, imgsrc });
}

console.log(`=== Extracted ${activities.length} activities ===`);
for (const a of activities) {
  console.log(
    `  ${a.idx}. img=${a.imgsrc ? a.imgsrc.split("/").pop() : "(none)"} | intro="${a.intro.slice(0, 50)}..."`,
  );
}

// Build new contentHtml
const newSectionParts = [
  '<h3 class="wp-block-heading"><strong>ผลงานปัจจุบัน</strong></h3>',
];
newSectionParts.push('\n\n<div class="wijai-current">');

for (const a of activities) {
  newSectionParts.push(`\n  <section class="wijai-item">`);
  newSectionParts.push(`\n    <h4 class="yutth-title">${a.idx}. ${a.intro}</h4>`);
  if (a.imgsrc) {
    newSectionParts.push(`\n    <div class="yutth-gallery yutth-gallery-3col">`);
    newSectionParts.push(
      `\n      <figure><img loading="lazy" decoding="async" src="${a.imgsrc}" data-lightbox="yutth" alt="" /></figure>`,
    );
    newSectionParts.push(`\n    </div>`);
  }
  newSectionParts.push(`\n  </section>`);
}

// Gallery section (all 3 figures together)
newSectionParts.push(`\n  <section class="wijai-item">`);
newSectionParts.push(`\n    <h4 class="yutth-title">ภาพประกอบการดำเนินงาน</h4>`);
newSectionParts.push(`\n    <div class="yutth-gallery yutth-gallery-3col">`);
for (const a of activities) {
  if (a.imgsrc) {
    newSectionParts.push(
      `\n      <figure><img loading="lazy" decoding="async" src="${a.imgsrc}" data-lightbox="yutth" alt="" /></figure>`,
    );
  }
}
newSectionParts.push(`\n    </div>`);
newSectionParts.push(`\n  </section>`);

newSectionParts.push("\n</div>");
const newSection = newSectionParts.join("");
const newContentHtml = prefix + newSection + suffix;
console.log(
  `\nNew contentHtml: ${newContentHtml.length} chars (vs original ${html.length})`,
);

// Backup + UPDATE
await prisma.siteMeta.upsert({
  where: { key: "database-content-backup" },
  create: { key: "database-content-backup", value: html },
  update: { value: html },
});
await prisma.siteMeta.upsert({
  where: { key: "database-excerpt-backup" },
  create: { key: "database-excerpt-backup", value: r.excerpt },
  update: { value: r.excerpt },
});

await prisma.contentRecord.update({
  where: { path: PATH },
  data: { excerpt: "", contentHtml: newContentHtml },
});

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
