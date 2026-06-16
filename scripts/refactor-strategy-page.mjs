// Refactor หน้า /ผลงานและโครงการเด่น/ยุทธศาสตร์-เทคโนโลยี-ระบ
// Section "ผลงานปัจจุบัน" เปลี่ยน layout เป็น:
//   1. list 4 ข้อ พร้อมหัวข้อ 1. 2. 3. 4.
//   2. รูป 1.png hero เต็มความกว้าง
//   3. 2x2 grid ของ 2.png, 3.png, 4.jpg, strategy.png
//
// ทำทั้ง TH และ EN

import pg from "pg";
import { readFile, writeFile } from "node:fs/promises";

const TH_ID = "th-page-412";
const EN_ID = "en-page-412";
const BACKUP_KEY_TH = "strategy_layout_v1_th_backup";
const BACKUP_KEY_EN = "strategy_layout_v1_en_backup";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

async function loadRecord(id) {
  const r = await c.query(
    'SELECT id, language, "contentHtml" FROM "ContentRecord" WHERE id=$1',
    [id],
  );
  return r.rows[0];
}

async function stashBackup(key, html) {
  await c.query(
    `INSERT INTO "SiteMeta" (key, value)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`,
    [key, JSON.stringify(html)],
  );
  console.log(`[backup] stashed ${key} (${html.length} bytes)`);
}

// แทนที่ทุกอย่างตั้งแต่ h3 ของ section นี้เป็นต้นไป
function refactorHtml(oldHtml, lang) {
  // ใช้ marker ตามภาษา
  const marker = lang === "th" ? "ผลงานปัจจุบัน" : "Project Deliverables";
  const idx = oldHtml.indexOf(marker);
  if (idx === -1) {
    throw new Error(`Cannot find ${marker} marker in HTML (lang=${lang})`);
  }
  // หา <h3 ...>...marker...</h3>
  const h3Start = oldHtml.lastIndexOf("<h3", idx);
  if (h3Start === -1) {
    throw new Error("Cannot find opening <h3");
  }
  const h3End = oldHtml.indexOf("</h3>", idx);
  if (h3End === -1) {
    throw new Error("Cannot find closing </h3>");
  }
  const before = oldHtml.slice(0, h3Start);

  // เนื้อหาเดิมใน section นี้ — ตั้งแต่ h3 จนถึงจบ HTML
  const oldSection = oldHtml.slice(h3Start);
  // ดึง figure ออกมา 5 รูป (figure ใน HTML มีทั้ง figure และ figure ซ้อน)
  const figures = [];
  const figureRegex = /<figure\b[\s\S]*?<\/figure>/g;
  let fm;
  while ((fm = figureRegex.exec(oldSection)) !== null) {
    figures.push(fm[0]);
  }
  console.log(`  found ${figures.length} figures`);

  // แมปรูปตาม src (ไม่ใช่ srcset — เพราะ "1-18x12.png" มี "2.png" substring)
  const getSrc = (fig) => {
    const m = fig.match(/<img\b[^>]*\bsrc="([^"]+)"/);
    return m ? m[1] : "";
  };
  const findFig = (filename) => {
    return (
      figures.find((f) => getSrc(f).endsWith("/" + filename) || getSrc(f) === filename) ||
      ""
    );
  };

  const hero = findFig("1.png");
  const fig2 = findFig("2.png");
  const fig3 = findFig("3.png");
  const fig4 = findFig("4.jpg");
  const figStrategy = findFig("strategy.png");
  console.log(
    `  matched: hero=${!!hero} 2=${!!fig2} 3=${!!fig3} 4=${!!fig4} strategy=${!!figStrategy}`,
  );

  // list 4 ข้อ — แยกตามภาษา
  const listItems =
    lang === "th"
      ? [
          "ที่ประชุมคณะกรรมการดำเนินงานความร่วมมือฯ ครั้งที่ 1/2566 เมื่อวันอังคารที่ 28 กุมภาพันธ์ 2566 มีมติเห็นชอบหลักการและความก้าวหน้าการดำเนินงานโครงการจัดทำยุทธศาสตร์ด้านเทคโนโลยีระบบรางของประเทศ",
          "ศึกษาภาคสนามในพื้นที่ศักยภาพเป็นศูนย์กลางระบบราง ได้แก่ จังหวัดขอนแก่น พื้นที่การค้าชายแดนจังหวัดหนองคาย ศูนย์กระจายสินค้าผลไม้จังหวัดระยองและจันทบุรี",
          "สำรวจข้อมูลด้านการขนส่งสินค้าผ่านแดนรูปแบบต่างๆ เชื่อมต่อระหว่างแนว Belt Road Initiative เข้ากับเขตเศรษฐกิจในประเทศไทย และจัดทำบทวิเคราะห์ด้านการส่งเสริมการค้าชายแดนด้วยระบบราง",
          "จัดทำบทวิเคราะห์เกี่ยวกับการพัฒนาการขนส่งสินค้าประเภทยางพารา และการขนส่งสินค้าแบบควบคุมอุณหภูมิ",
        ]
      : [
          "The Meeting of MOU Operational Committee No. 1/2023, held on 28th February 2023, had the resolution to approve principles and progress of the Project for Establishing Strategies of the Railway system of Thailand.",
          "Conduct field surveys in areas with the potential to become the hub of the railway system, including Khon Kaen, Nong Khai border trade areas, and fruit products distribution centers in Rayong, and Chantaburi Province.",
          "Surveyed the cross-border goods transportation in various forms connected between the Belt Road Initiative and economic zones in Thailand, and prepared an analysis on promoting cross-border trade with the railway system.",
          "Prepared analysis on the development of rubber product transportation and temperature-controlled goods transportation.",
        ];

  // ใช้ listItems เดียวกันทั้ง TH/EN (เนื้อหาเดิมเป็น TH ทั้งคู่)

  // สร้าง section ใหม่
  // 1. list 4 ข้อ พร้อมหัวข้อ 1-4
  const listHtml = listItems
    .map(
      (txt, i) => `
<div class="strategy-step">
  <div class="strategy-step-number">${i + 1}</div>
  <div class="strategy-step-body">${txt}</div>
</div>`,
    )
    .join("\n");

  // 3. 2x2 grid
  const gridHtml = `
<div class="strategy-grid">
  <div class="strategy-grid-cell">${fig2}</div>
  <div class="strategy-grid-cell">${fig3}</div>
  <div class="strategy-grid-cell">${fig4}</div>
  <div class="strategy-grid-cell">${figStrategy}</div>
</div>`;

  // heading text ตามภาษา
  const heading = lang === "th" ? "ผลงานปัจจุบัน" : "Project Deliverables";

  const newSection = `<h3 class="wp-block-heading"><strong>${heading}</strong>&nbsp;</h3>

<div class="strategy-steps">
${listHtml}
</div>

<div class="strategy-hero">
${hero}
</div>

${gridHtml}`;

  return before + newSection;
}

// ทำ TH
const thRec = await loadRecord(TH_ID);
console.log(`[th] old length: ${thRec.contentHtml.length}`);
await stashBackup(BACKUP_KEY_TH, thRec.contentHtml);
const thNew = refactorHtml(thRec.contentHtml, "th");
console.log(`[th] new length: ${thNew.length}`);

// ทำ EN
const enRec = await loadRecord(EN_ID);
console.log(`[en] old length: ${enRec.contentHtml.length}`);
await stashBackup(BACKUP_KEY_EN, enRec.contentHtml);
const enNew = refactorHtml(enRec.contentHtml, "en");
console.log(`[en] new length: ${enNew.length}`);

// เขียน DB
await c.query('UPDATE "ContentRecord" SET "contentHtml"=$1 WHERE id=$2', [thNew, TH_ID]);
console.log(`[th] DB updated`);
await c.query('UPDATE "ContentRecord" SET "contentHtml"=$1 WHERE id=$2', [enNew, EN_ID]);
console.log(`[en] DB updated`);

// Mirror to JSON
const j = JSON.parse(await readFile("src/data/wp-content.json", "utf8"));
let mirrored = 0;
for (const rec of j.records) {
  if (rec.id === TH_ID) {
    rec.contentHtml = thNew;
    mirrored++;
  } else if (rec.id === EN_ID) {
    rec.contentHtml = enNew;
    mirrored++;
  }
}
await writeFile("src/data/wp-content.json", JSON.stringify(j, null, 2) + "\n");
console.log(`[json] mirrored ${mirrored} records`);

await c.end();
console.log("DONE");
