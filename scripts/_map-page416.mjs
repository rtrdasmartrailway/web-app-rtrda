// Map th-page-416 contentHtml structure
import { prisma } from "@/lib/db/client";

const r = await prisma.contentRecord.findUnique({
  where: { path: "/ผลงานและโครงการเด่น/มาตรฐาน-ระบบทดสอบ" },
});
if (!r) {
  console.log("NOT FOUND");
  process.exit(1);
}

const html = r.contentHtml;

// Find all h3 positions
const h3matches = [...html.matchAll(/<h3[^>]*>(.*?)<\/h3>/g)];
console.log("=== H3 positions ===");
for (const m of h3matches) {
  const cleanText = m[1]
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  console.log(`  idx ${m.index}: "${cleanText.slice(0, 50)}"`);
}

// Find all ol positions + li counts
console.log("");
console.log("=== OL/UL positions ===");
const olMatches = [...html.matchAll(/<ol\b[^>]*>/g)];
for (const m of olMatches) {
  const closeIdx = html.indexOf("</ol>", m.index);
  const body = html.slice(m.index, closeIdx + 5);
  const liCount = (body.match(/<li\b/g) || []).length;
  const textSnippet = body
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  console.log(`  idx ${m.index}: <ol> with ${liCount} <li> | "${textSnippet}"`);
}

const ulMatches = [...html.matchAll(/<ul\b[^>]*>/g)];
for (const m of ulMatches) {
  const closeIdx = html.indexOf("</ul>", m.index);
  const body = html.slice(m.index, closeIdx + 5);
  const liCount = (body.match(/<li\b/g) || []).length;
  const textSnippet = body
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  console.log(`  idx ${m.index}: <ul> with ${liCount} <li> | "${textSnippet}"`);
}

// Find all figure positions
console.log("");
console.log("=== FIGURE positions ===");
const figMatches = [...html.matchAll(/<figure\b[^>]*>/g)];
console.log(`  total: ${figMatches.length}`);
for (const m of figMatches) {
  const closeIdx = html.indexOf("</figure>", m.index);
  const body = html.slice(m.index, closeIdx + 9);
  const imgMatch = body.match(/<img[^>]*src="([^"]+)"/);
  const imgsrc = imgMatch ? imgMatch[1].split("/").pop().slice(0, 40) : "(no img)";
  console.log(`  idx ${m.index}: <figure> -> ${imgsrc}`);
}

// Find <h3>ผลงานปัจจุบัน</h3> start + end of section (next h3 or end)
const curIdx = html.indexOf("ผลงานปัจจุบัน");
if (curIdx > 0) {
  // start = position of <h3 tag before this text
  const h3Start = html.lastIndexOf("<h3", curIdx);
  // end = next h3 or end
  let endPos = html.length;
  for (const m of h3matches) {
    if (m.index > h3Start) {
      endPos = m.index;
      break;
    }
  }
  console.log("");
  console.log(
    `=== 'ผลงานปัจจุบัน' section: ${h3Start}..${endPos} (${endPos - h3Start} chars) ===`,
  );
  console.log(`  body preview:`);
  const body = html.slice(h3Start, endPos);
  // Strip figures for readability
  const bodyNoFigs = body.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/g, "<FIGURE/>");
  console.log(bodyNoFigs.slice(0, 2000));
}

await prisma.$disconnect();
