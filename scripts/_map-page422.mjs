import { prisma } from "@/lib/db/client";
const r = await prisma.contentRecord.findUnique({
  where: { path: "/ผลงานและโครงการเด่น/ฐานข้อมูล-เทคโนโลยี-ระบบ" },
});
if (!r) {
  console.log("NOT FOUND");
  process.exit(1);
}
const html = r.contentHtml;

console.log("=== H3 positions ===");
for (const m of html.matchAll(/<h3[^>]*>(.*?)<\/h3>/g)) {
  const cleanText = m[1]
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  console.log(`  idx ${m.index}: "${cleanText.slice(0, 50)}"`);
}

console.log("\n=== OL/UL positions ===");
for (const m of html.matchAll(/<ol\b[^>]*>/g)) {
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
for (const m of html.matchAll(/<ul\b[^>]*>/g)) {
  const closeIdx = html.indexOf("</ul>", m.index);
  const body = html.slice(m.index, closeIdx + 5);
  const liCount = (body.match(/<li\b/g) || []).length;
  console.log(`  idx ${m.index}: <ul> with ${liCount} <li>`);
}

console.log("\n=== FIGURE positions ===");
const figMatches = [...html.matchAll(/<figure\b[^>]*>[\s\S]*?<\/figure>/g)];
console.log(`  total: ${figMatches.length}`);
for (const m of figMatches) {
  const body = m[0];
  const imgMatch = body.match(/<img[^>]*\bsrc="([^"]+)"/);
  const imgsrc = imgMatch ? imgMatch[1].split("/").pop().slice(0, 40) : "(no img)";
  console.log(`  idx ${m.index}: <figure> -> ${imgsrc}`);
}

const h3Start = html.lastIndexOf("<h3", html.indexOf("ผลงานปัจจุบัน"));
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
const bodyNoFigs = body.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/g, "<FIGURE/>");
console.log(bodyNoFigs.slice(0, 2000));

await prisma.$disconnect();
