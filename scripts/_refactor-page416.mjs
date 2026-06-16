// Refactor th-page-416: 8 sections (1 event = 1 section with gallery under body)
import { prisma } from "@/lib/db/client";

const PATH = "/ผลงานและโครงการเด่น/มาตรฐาน-ระบบทดสอบ";

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

// === Step 2: Extract all ol positions + all figure positions ===
// Each <ol> contains intro for 1 event
const olMatches = [...oldSection.matchAll(/<ol\b[^>]*>([\s\S]*?)<\/ol>/g)];
const olPositions = olMatches.map((m) => ({ idx: m.index, body: m[1] }));

// All <figure> positions in old section (flat, top-level)
const figureMatches = [...oldSection.matchAll(/<figure\b[^>]*>[\s\S]*?<\/figure>/g)];
const figurePositions = figureMatches.map((m) => {
  const figBody = m[0];
  const imgMatch = figBody.match(/<img[^>]*\bsrc="([^"]+)"/);
  return {
    idx: m.index,
    end: m.index + m[0].length,
    imgsrc: imgMatch ? imgMatch[1] : null,
  };
});

// === Step 3: For each ol, find figures that come AFTER this ol but BEFORE next ol ===
const events = [];
for (let i = 0; i < olPositions.length; i++) {
  const ol = olPositions[i];
  const nextOlIdx =
    i + 1 < olPositions.length ? olPositions[i + 1].idx : oldSection.length;
  const liText = ol.body.match(/<li[^>]*>([\s\S]*?)<\/li>/)?.[1] || "";
  const intro = liText
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Figures after this ol but before next ol
  const figures = figurePositions
    .filter((f) => f.idx > ol.idx && f.idx < nextOlIdx)
    .map((f) => {
      if (!f.imgsrc) return null;
      return f.imgsrc.startsWith("http")
        ? f.imgsrc
        : `https://www.rtrda.or.th${f.imgsrc.startsWith("/") ? "" : "/"}${f.imgsrc}`;
    })
    .filter(Boolean);

  events.push({ idx: i + 1, intro, figures });
}

console.log(`=== ${events.length} events extracted (position-based) ===`);
for (const e of events) {
  console.log(
    `  ${e.idx}. figures=${e.figures.length} | intro="${e.intro.slice(0, 60)}..."`,
  );
}

// === Step 4: Build new contentHtml ===
function deriveHeading(intro) {
  const cleaned = intro
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
  let h = cleaned.split(/เมื่อวัน/)[0].trim();
  h = h.split(/,\s/)[0].trim();
  if (h.length > 80) h = h.slice(0, 80).trim() + "...";
  return h || cleaned.slice(0, 60);
}

const newSectionParts = [
  '<h3 class="wp-block-heading"><strong>ผลงานปัจจุบัน</strong></h3>',
];
newSectionParts.push('\n\n<div class="wijai-current">');

for (const e of events) {
  const heading = deriveHeading(e.intro);
  newSectionParts.push(`\n  <section class="wijai-item">`);
  newSectionParts.push(`\n    <h4 class="yutth-title">${e.idx}. ${heading}</h4>`);
  newSectionParts.push(`\n    <p>${e.intro}</p>`);
  if (e.figures.length > 0) {
    newSectionParts.push(`\n    <div class="yutth-gallery yutth-gallery-3col">`);
    for (const src of e.figures) {
      newSectionParts.push(
        `\n      <figure><img loading="lazy" decoding="async" src="${src}" data-lightbox="yutth" alt="" /></figure>`,
      );
    }
    newSectionParts.push(`\n    </div>`);
  }
  newSectionParts.push(`\n  </section>`);
}

newSectionParts.push("\n</div>");
const newSection = newSectionParts.join("");
const newContentHtml = prefix + newSection + suffix;
console.log(
  `\nNew contentHtml: ${newContentHtml.length} chars (vs original ${html.length})`,
);

// === Step 5: Backup + UPDATE ===
// SiteMeta.value is Json — pass as string
await prisma.siteMeta.upsert({
  where: { key: "matthra-test-content-backup" },
  create: { key: "matthra-test-content-backup", value: html },
  update: { value: html },
});
await prisma.siteMeta.upsert({
  where: { key: "matthra-test-excerpt-backup" },
  create: { key: "matthra-test-excerpt-backup", value: r.excerpt },
  update: { value: r.excerpt },
});

await prisma.contentRecord.update({
  where: { path: PATH },
  data: { excerpt: "", contentHtml: newContentHtml },
});

// === Step 6: Verify ===
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
  `  imgs absolute (http): ${(r2.contentHtml.match(/src="https:\/\//g) || []).length}`,
);

await prisma.$disconnect();
