// Refactor หน้า /เกี่ยวกับ-สทร/ค่านิยมองค์กร
// แยก HTML เดิม (1 wp-block-columns มี 5 column ที่รวม figure+letter+label+number+body ผสมกัน)
// ออกเป็น 2 กลุ่ม:
//   - values-top-cards   : 5 การ์ด (figure + ตัวอักษรในวงกลม + label "RELEVANCE" ใหญ่)
//   - values-bottom-cols : 5 column (ตัวอักษร R/T/R/D/A ใหญ่ + เส้นใต้ gradient + (RELEVANCE) + 01-05 + body)
//
// ทำทั้ง TH และ EN

import pg from "pg";
import { readFile, writeFile } from "node:fs/promises";

const TH_ID = "th-page-404";
const EN_ID = "en-page-404";
const PAGE_PATH = "/เกี่ยวกับ-สทร/ค่านิยมองค์กร";
const BACKUP_KEY_TH = "values_layout_v1_th_backup";
const BACKUP_KEY_EN = "values_layout_v1_en_backup";

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

// แยก 5 column จาก HTML เก่า เป็น top-cards และ bottom-cols
function refactorHtml(oldHtml) {
  // 1. ตัด <div class="values-letters">...</div> ออก (ถ้ามี) — เราจะใส่ใหม่
  // 2. ตัด wrapper นอกของ wp-block-columns ออก
  // 3. แยกเนื้อหาแต่ละ column

  // หา outer columns wrapper
  const outerMatch = oldHtml.match(
    /<div class="wp-block-columns vision[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<p><\/p>\s*$/,
  );
  if (!outerMatch) {
    // ลองรูปแบบอื่น: มี column ครอบ 1 ชั้น
    const altMatch = oldHtml.match(
      /<div class="wp-block-columns vision[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<p><\/p>\s*$/,
    );
    if (!altMatch) {
      throw new Error("Cannot match outer columns wrapper");
    }
    return refactorFromInner(altMatch[1]);
  }
  return refactorFromInner(outerMatch[1]);
}

function refactorFromInner(innerHtml) {
  // innerHtml = "<div class="wp-block-column vision..."> ... 5 inner wp-block-columns ... </div> </div>"
  // ดึงแต่ละ column ด้านใน
  const inner = innerHtml.match(
    /<div class="wp-block-columns[^"]*"[^>]*>([\s\S]*?)<\/div>\s*$/,
  );
  if (!inner) {
    throw new Error("Cannot find inner columns block");
  }
  const fiveColumns = inner[1];

  // แยก column ออกมาเป็น array
  const colRegex =
    /<div class="wp-block-column is-layout-flow[^"]*"[^>]*>([\s\S]*?)<\/div>(?=\s*<div class="wp-block-column|\s*$)/g;
  const columns = [];
  let m;
  while ((m = colRegex.exec(fiveColumns)) !== null) {
    columns.push(m[1]);
  }

  if (columns.length !== 5) {
    throw new Error(`Expected 5 columns, found ${columns.length}`);
  }

  // แต่ละ column มี: figure + h3(letter) + p(label) + h1(number) + p(body)
  const data = columns.map((col, i) => {
    const figureMatch = col.match(/<figure[\s\S]*?<\/figure>/);
    const letterMatch = col.match(
      /<h3 class="wp-block-heading[^"]*"><strong>(\S)\s*<\/strong><\/h3>/,
    );
    // label อยู่ใน <p class="has-text-align-right"><strong>(...)</strong></p>
    // เนื้อหาข้างในวงเล็บอาจมี <strong>...</strong> ซ้อน และอาจมี &amp;
    // ดึง p แล้ว strip tag + decode entity
    const labelP = col.match(
      /<p class="has-text-align-right"><strong>\(\s*(?:<strong>)?([\s\S]*?)(?:<\/strong>)?\s*\)<\/strong><\/p>/,
    );
    const label = labelP
      ? labelP[1]
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .trim()
      : "";
    const numberMatch = col.match(
      /<h1 class="wp-block-heading has-text-align-right">(\d+)<\/h1>/,
    );
    // body = <p class="has-text-align-right">...</p> อันสุดท้าย (ไม่ใช่ตัวที่ห่อ label)
    // หาทุก p.has-text-align-right แล้วเอาอันที่ไม่ใช่ label
    const allP = [...col.matchAll(/<p class="has-text-align-right">([\s\S]*?)<\/p>/g)];
    let body = "";
    for (const pm of allP) {
      const txt = pm[1];
      if (/^\s*<strong>\s*\(/.test(txt) || /^\s*\(/.test(txt)) continue; // label
      if (/^\s*<strong>[A-Z]/.test(txt)) continue; // กรณี label ที่ strong อยู่นอก
      body = txt.replace(/<[^>]+>/g, "").trim();
      if (body) break;
    }

    return {
      letter: letterMatch ? letterMatch[1] : "?",
      label,
      number: numberMatch ? numberMatch[1] : String(i + 1).padStart(2, "0"),
      body,
      figure: figureMatch ? figureMatch[0] : "",
    };
  });

  // สร้าง HTML ใหม่
  // กลุ่มบน: 5 cards (มีแค่รูปเพราะรูปต้นฉบับมี R ในวงกลม + label RELEVANCE ในตัวแล้ว)
  const topCards = data
    .map(
      (d) => `
<div class="values-card">
  <div class="values-card-image">${d.figure}</div>
</div>`,
    )
    .join("\n");

  // กลุ่มล่าง: 5 columns
  const bottomCols = data
    .map(
      (d) => `
<div class="values-col">
  <div class="values-col-letter">${d.letter}</div>
  <div class="values-col-rule"></div>
  <div class="values-col-label">(${d.label})</div>
  <div class="values-col-number">${d.number}</div>
  <p class="values-col-body">${d.body}</p>
</div>`,
    )
    .join("\n");

  return `<div class="values-letters"><span class="vl-letter">R</span><span class="vl-letter">T</span><span class="vl-letter">R</span><span class="vl-letter">D</span><span class="vl-letter">A</span></div>

<div class="values-top-cards">
${topCards}
</div>

<div class="values-bottom-cols">
${bottomCols}
</div>

<p></p>`;
}

// ทำ TH
const thRec = await loadRecord(TH_ID);
console.log(`[th] old length: ${thRec.contentHtml.length}`);
await stashBackup(BACKUP_KEY_TH, thRec.contentHtml);
const thNew = refactorHtml(thRec.contentHtml);
console.log(`[th] new length: ${thNew.length}`);

// ทำ EN
const enRec = await loadRecord(EN_ID);
console.log(`[en] old length: ${enRec.contentHtml.length}`);
await stashBackup(BACKUP_KEY_EN, enRec.contentHtml);
const enNew = refactorHtml(enRec.contentHtml);
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
