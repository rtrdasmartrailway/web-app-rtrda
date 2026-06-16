// Refactor th-page-396: convert 2-col grid → vertical zigzag stack
// Output: replaces inner <div class="wp-block-columns vision..."> structure
// with 6 <div class="vision-row vision-row-{odd|even}"> + image + content blocks

import { readFileSync, writeFileSync } from "fs";

const SQL = process.env.DATABASE_URL;
if (!SQL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

import pg from "/srv/workspace/web-app-rtrda/node_modules/pg/lib/index.js";
const c = new pg.Client({ connectionString: SQL });
await c.connect();

// Source data extracted from current HTML (DB version)
// 6 entries: image URL, title, number, content
const entries = [
  {
    img: "/wp-content/uploads/2023/02/strategy.png",
    title: "ยุทธศาสตร์",
    num: "01",
    text: "จัดทำยุทธศาสตร์ด้านเทคโนโลยีระบบรางของประเทศเสนอต่อคณะรัฐมนตรีเพื่อพิจารณา",
  },
  {
    img: "/wp-content/uploads/2023/02/research.png",
    title: "วิจัยและพัฒนา",
    num: "02",
    text: "วิจัยและพัฒนาเทคโนโลยีระบบรางรวมทั้งสร้างนวัตกรรมเกี่ยวกับระบบราง และร่วมมือกับหน่วยงานภาครัฐและเอกชนเพื่อนำงานวิจัยและนวัตกรรมไปใช้ประโยชน์",
  },
  {
    img: "/wp-content/uploads/2023/02/standard.png",
    title: "มาตรฐาน",
    num: "03",
    text: "วิจัยและพัฒนามาตรฐานระบบรางและระบบการทดสอบด้านระบบราง ดำเนินการทดสอบด้านระบบราง และรับรองมาตรฐานและประเมินคุณภาพสำหรับใช้ประกอบการยื่นคำขอใบอนุญาตประกอบกิจการขนส่งทางราง",
  },
  {
    img: "/wp-content/uploads/2023/02/cooperation.png",
    title: "ความร่วมมือ",
    num: "04",
    text: "ร่วมมือกับหน่วยงานภาครัฐและเอกชนทั้งในประเทศและต่างประเทศ ด้านการวิจัยและนวัตกรรม และการรับ แลกเปลี่ยนถ่ายทอดและพัฒนาเทคโนโลยีระบบราง และเป็นศูนย์กลางในการรับ แลกเปลี่ยน และถ่ายทอดเทคโนโลยีระบบราง",
  },
  {
    img: "/wp-content/uploads/2023/02/manpower.png",
    title: "พัฒนาบุคลากร",
    num: "05",
    text: "พัฒนาบุคลากรด้านระบบรางและจัดให้มีการฝึกอบรมเพื่อให้การรับรองความรู้และทักษะให้แก่บุคลากรด้านระบบราง",
  },
  {
    img: "/wp-content/uploads/2023/02/database.png",
    title: "ฐานข้อมูล",
    num: "06",
    text: "จัดทำฐานข้อมูลด้านเทคโนโลยีระบบราง เพื่อรวบรวมข้อมูลเกี่ยวกับงานวิจัยและนวัตกรรม หน่วยงาน ผู้เชี่ยวชาญ และ ข้อมูลอื่นที่เกี่ยวข้องกับเทคโนโลยีระบบราง",
  },
];

// Build new HTML
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const rows = entries
  .map(
    (e, i) => `
<div class="vision-row vision-row-${i % 2 === 0 ? "odd" : "even"}">
  <div class="vision-figure">
    <img src="${e.img}" alt="${escapeHtml(e.title)}" loading="lazy" decoding="async" />
  </div>
  <div class="vision-content">
    <div class="vision-number">${e.num}</div>
    <h3 class="vision-title">${escapeHtml(e.title)}</h3>
    <p class="vision-text">${escapeHtml(e.text)}</p>
  </div>
</div>
`,
  )
  .join("");

// Wrap in <div class="vision-stack">
const newVisionBlock = `<div class="vision-stack">\n${rows}\n</div>`;

// Original HTML structure:
// <h2>วิสัยทัศน์</h2> + blockquote + spacer + <h2>พันธกิจ</h2> + old vision block
// We KEEP vision blockquote + h2's, just REPLACE the inner <div class="wp-block-columns vision...">...</div>

const r = await c.query('SELECT "contentHtml" FROM "ContentRecord" WHERE id = $1', [
  "th-page-396",
]);
const oldHtml = r.rows[0].contentHtml;

// Find the vision block — match the outer wp-block-columns.vision + nested structures
// Simplest: replace from "<div class=\"wp-block-columns vision is-layout-flex" up to the LAST closing </div> in the right depth
// Use a simple regex on the start tag
const startTag = oldHtml.indexOf('<div class="wp-block-columns vision is-layout-flex');
if (startTag === -1) {
  console.error("Could not find vision block in HTML");
  process.exit(1);
}

// Find matching close — count div depth
let depth = 0;
let i = startTag;
let inDiv = false;
let endIdx = -1;
const re = /<div\b|<\/div>/g;
re.lastIndex = startTag;
let m;
while ((m = re.exec(oldHtml))) {
  if (m[0] === "<div") {
    depth++;
  } else {
    depth--;
    if (depth === 0) {
      endIdx = m.index + m[0].length;
      break;
    }
  }
}

if (endIdx === -1) {
  console.error("Could not find end of vision block");
  process.exit(1);
}

const newHtml = oldHtml.slice(0, startTag) + newVisionBlock + oldHtml.slice(endIdx);

console.log(`OLD: ${oldHtml.length} chars`);
console.log(`NEW: ${newHtml.length} chars`);
console.log(`Diff: ${newHtml.length - oldHtml.length} chars`);

// Save preview
writeFileSync("/tmp/vision-new.html", newHtml);

// Update DB
const r2 = await c.query(
  'UPDATE "ContentRecord" SET "contentHtml" = $1 WHERE id = $2 RETURNING id',
  [newHtml, "th-page-396"],
);
console.log("Updated:", r2.rows.length, "rows");
await c.end();
