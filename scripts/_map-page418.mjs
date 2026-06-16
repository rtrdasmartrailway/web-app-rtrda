// Map th-page-418 contentHtml structure
import { prisma } from "@/lib/db/client";

const r = await prisma.contentRecord.findUnique({
  where: { path: "/ผลงานและโครงการเด่น/พัฒนา-บุคลากร-ระบบราง" },
});
if (!r) {
  console.log("NOT FOUND");
  process.exit(1);
}

const html = r.contentHtml;
console.log(`path: ${r.path}`);
console.log(`title: ${r.title}`);
console.log(`excerpt.len: ${r.excerpt.length}`);
console.log(`excerpt.preview: ${r.excerpt.slice(0, 80).replace(/\n/g, " ")}`);
console.log(`contentHtml.len: ${html.length}`);
console.log(`has wijai-item: ${html.includes("wijai-item")}`);
console.log(`has yutth-title: ${html.includes("yutth-title")}`);
console.log(`has yutth-gallery-3col: ${html.includes("yutth-gallery-3col")}`);

// H3 positions
console.log("\n=== H3 positions ===");
for (const m of html.matchAll(/<h3[^>]*>(.*?)<\/h3>/g)) {
  const clean = m[1]
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  console.log(`  idx ${m.index}: "${clean.slice(0, 50)}"`);
}

// OL positions
console.log("\n=== OL positions ===");
for (const m of html.matchAll(/<ol\b[^>]*>/g)) {
  const close = html.indexOf("</ol>", m.index);
  const body = html.slice(m.index, close + 5);
  const liCount = (body.match(/<li\b/g) || []).length;
  const text = body
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  console.log(`  idx ${m.index}: ${liCount} li | "${text}"`);
}

// Figure positions
console.log("\n=== FIGURE positions ===");
const figs = [...html.matchAll(/<figure\b[^>]*>/g)];
console.log(`  total: ${figs.length}`);
for (const m of figs) {
  const close = html.indexOf("</figure>", m.index);
  const body = html.slice(m.index, close + 9);
  const img = body.match(/<img[^>]*src="([^"]+)"/);
  const src = img ? img[1].split("/").pop().slice(0, 40) : "(no img)";
  console.log(`  idx ${m.index}: ${src}`);
}

// Find 'ผลงานปัจจุบัน' section
const curIdx = html.indexOf("ผลงานปัจจุบัน");
if (curIdx > 0) {
  const h3Start = html.lastIndexOf("<h3", curIdx);
  let endPos = html.length;
  for (const m of html.matchAll(/<h3\b/g)) {
    if (m.index > h3Start) {
      endPos = m.index;
      break;
    }
  }
  console.log(
    `\n=== 'ผลงานปัจจุบัน' section: ${h3Start}..${endPos} (${endPos - h3Start} chars) ===`,
  );
  const body = html.slice(h3Start, endPos);
  // Strip figures for readability
  const bodyNoFigs = body.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/g, "<FIGURE/>");
  console.log(bodyNoFigs.slice(0, 3000));
}

await prisma.$disconnect();
