// ปรับหน้า "ค่านิยมองค์กร" — clear excerpt + เปลี่ยนเป็น zigzag alternating 5 แถว

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// backup
const oldTh = await p.contentRecord.findUnique({
  where: { path: "/เกี่ยวกับ-สทร/ค่านิยมองค์กร" },
});
const oldEn = await p.contentRecord.findUnique({
  where: { path: "/en/เกี่ยวกับ-สทร/ค่านิยมองค์กร" },
});

await p.siteMeta.upsert({
  where: { key: "values_excerpt_backup_th" },
  update: { value: oldTh.excerpt },
  create: { key: "values_excerpt_backup_th", value: oldTh.excerpt },
});
await p.siteMeta.upsert({
  where: { key: "values_excerpt_backup_en" },
  update: { value: oldEn.excerpt },
  create: { key: "values_excerpt_backup_en", value: oldEn.excerpt },
});

await p.siteMeta.upsert({
  where: { key: "values_backup_v1_th" },
  update: { value: oldTh.contentHtml },
  create: { key: "values_backup_v1_th", value: oldTh.contentHtml },
});
await p.siteMeta.upsert({
  where: { key: "values_backup_v1_en" },
  update: { value: oldEn.contentHtml },
  create: { key: "values_backup_v1_en", value: oldEn.contentHtml },
});

const items = {
  th: [
    {
      num: "01",
      letter: "R",
      full: "RELEVANCE",
      img: "/wp-content/uploads/2025/02/3.png",
      body: "มุ่งเน้นการสร้างผลงานให้สอดคล้องตามทิศทางขององค์กร และตอบรับความต้องการของผู้มีส่วนได้ส่วนเสีย",
    },
    {
      num: "02",
      letter: "T",
      full: "TRANSPARENCY",
      img: "/wp-content/uploads/2025/02/2.png",
      body: "ปฏิบัติหน้าที่ด้วยความสุจริต โปร่งใส เสมอภาค เป็นธรรม และรายงานข้อมูลกับผู้เกี่ยวข้องอย่างตรงไปตรงมา",
    },
    {
      num: "03",
      letter: "R",
      full: "RESILIENCE & AGILITY",
      img: "/wp-content/uploads/2026/02/R.jpg",
      body: "สามารถปรับตัวและตอบสนองต่อสถานการณ์ที่เปลี่ยนแปลงได้อย่างรวดเร็ว รองรับการเปลี่ยนแปลงในอนาคต",
    },
    {
      num: "04",
      letter: "D",
      full: "DELIVERABILITY",
      img: "/wp-content/uploads/2025/02/4-1.png",
      body: "เข้าใจในงานที่ได้รับมอบหมาย จัดการงานและอุปสรรคในงานได้อย่างมืออาชีพ และสามารถส่งมอบงานได้อย่างมีประสิทธิภาพและประสิทธิผล",
    },
    {
      num: "05",
      letter: "A",
      full: "ACCOUNTABILITY",
      img: "/wp-content/uploads/2025/02/5.png",
      body: "รับผิดชอบต่องานที่ได้รับมอบหมาย โดยคำนึงถึง คุณภาพ ปริมาณ เวลาและตระหนักถึงหลักธรรมาภิบาล และผลกระทบของการตัดสินใจที่จะมีผลต่อผู้เกี่ยวข้องอย่างรอบด้าน",
    },
  ],
  en: [
    {
      num: "01",
      letter: "R",
      full: "RELEVANCE",
      img: "/wp-content/uploads/2025/02/3.png",
      body: "Focus on creating work aligned with the organization’s direction and responsive to stakeholder needs.",
    },
    {
      num: "02",
      letter: "T",
      full: "TRANSPARENCY",
      img: "/wp-content/uploads/2025/02/2.png",
      body: "Perform duties with integrity, transparency, equity and fairness, and report information to stakeholders directly and truthfully.",
    },
    {
      num: "03",
      letter: "R",
      full: "RESILIENCE & AGILITY",
      img: "/wp-content/uploads/2026/02/R.jpg",
      body: "Able to adapt and respond quickly to changing situations, supporting future changes.",
    },
    {
      num: "04",
      letter: "D",
      full: "DELIVERABILITY",
      img: "/wp-content/uploads/2025/02/4-1.png",
      body: "Understand assigned work, professionally manage tasks and obstacles, and deliver work efficiently and effectively.",
    },
    {
      num: "05",
      letter: "A",
      full: "ACCOUNTABILITY",
      img: "/wp-content/uploads/2025/02/5.png",
      body: "Take responsibility for assigned work, considering quality, quantity, time and good governance, and the impact of decisions on all stakeholders.",
    },
  ],
};

function rowHtml(it, idx) {
  const imageLeft = idx % 2 === 0;
  const gridStyle = imageLeft
    ? "grid-template-columns:280px 1fr;"
    : "grid-template-columns:1fr 280px;";

  const imageBlock = `
    <div style="display:flex; align-items:center; ${imageLeft ? "justify-content:flex-start;" : "justify-content:flex-end;"}">
      <figure class="wp-block-image" style="margin:0;">
        <img loading="lazy" decoding="async" src="${it.img}" alt="${it.full}" style="display:block; width:100%; max-width:280px; height:auto; border-radius:12px; box-shadow:0 8px 24px rgba(0, 52, 113, 0.12), 0 2px 6px rgba(0,0,0,0.08);" />
      </figure>
    </div>`;

  const contentBlock = `
    <div style="position:relative; padding:0 0 0 ${imageLeft ? "32px" : "0"}; padding-right:${imageLeft ? "0" : "32px"}; text-align:left;">
      <div style="position:absolute; top:-8px; right:${imageLeft ? "0" : "32px"}; font-size:3.5rem; line-height:1; color:#003471; opacity:0.1; font-weight:800; letter-spacing:-1px; pointer-events:none; user-select:none;">${it.num}</div>
      <div style="display:flex; align-items:baseline; gap:16px; margin:0 0 8px;">
        <span style="font-size:2.5rem; font-weight:800; color:#003471; line-height:1; font-family:Georgia, serif;">${it.letter}</span>
        <h2 style="margin:0; font-size:1.1rem; color:#6b7280; font-weight:600; letter-spacing:1px; text-transform:uppercase;">
          ${it.full}
        </h2>
      </div>
      <div style="width:40px; height:2px; background:#003471; border-radius:1px; margin:0 0 16px;"></div>
      <p style="font-size:1rem; line-height:1.7; color:#374151; margin:0; max-width:520px;">${it.body}</p>
    </div>`;

  return `
<div class="vp-row" style="display:grid; align-items:center; gap:0; padding:40px 0; ${idx < items.th.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""} ${gridStyle}">
  ${imageLeft ? imageBlock + contentBlock : contentBlock + imageBlock}
</div>`;
}

function buildHtml(items) {
  const rowsHtml = items.map((it, idx) => rowHtml(it, idx)).join("");
  return `
<div class="vp-values-stack" style="width:100%;">
${rowsHtml}
</div>
`;
}

const thHtml = buildHtml(items.th);
const enHtml = buildHtml(items.en);

await p.contentRecord.update({
  where: { path: "/เกี่ยวกับ-สทร/ค่านิยมองค์กร" },
  data: { excerpt: "", contentHtml: thHtml, modified: new Date().toISOString() },
});
await p.contentRecord.update({
  where: { path: "/en/เกี่ยวกับ-สทร/ค่านิยมองค์กร" },
  data: { excerpt: "", contentHtml: enHtml, modified: new Date().toISOString() },
});

console.log("UPDATED TH (excerpt cleared, zigzag 5 rows)");
console.log("UPDATED EN (excerpt cleared, zigzag 5 rows)");
console.log("TH HTML LEN:", thHtml.length);
console.log("EN HTML LEN:", enHtml.length);
console.log("Backup saved: values_excerpt_backup_th/en, values_backup_v1_th/en");

await p.$disconnect();
