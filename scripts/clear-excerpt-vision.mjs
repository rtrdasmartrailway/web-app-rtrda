// 1) clear excerpt ของหน้า "วิสัยทัศน์" ทั้ง TH + EN
// 2) ปรับ section "วิสัยทัศน์" ใน contentHtml ให้สวยขึ้น

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ===== STEP 1: backup + clear excerpt =====
const oldTh = await p.contentRecord.findUnique({
  where: { path: "/เกี่ยวกับ-สทร/วิสัยทัศน์-พันธกิจ" },
});
const oldEn = await p.contentRecord.findUnique({
  where: { path: "/en/เกี่ยวกับ-สทร/วิสัยทัศน์-พันธกิจ" },
});

// เก็บ backup excerpt เก่าไว้ก่อน
await p.siteMeta.upsert({
  where: { key: "vision_excerpt_backup_th" },
  update: { value: oldTh.excerpt },
  create: { key: "vision_excerpt_backup_th", value: oldTh.excerpt },
});
await p.siteMeta.upsert({
  where: { key: "vision_excerpt_backup_en" },
  update: { value: oldEn.excerpt },
  create: { key: "vision_excerpt_backup_en", value: oldEn.excerpt },
});

// เก็บ HTML เก่าก่อนแก้
await p.siteMeta.upsert({
  where: { key: "vision_backup_v5_th" },
  update: { value: oldTh.contentHtml },
  create: { key: "vision_backup_v5_th", value: oldTh.contentHtml },
});
await p.siteMeta.upsert({
  where: { key: "vision_backup_v5_en" },
  update: { value: oldEn.contentHtml },
  create: { key: "vision_backup_v5_en", value: oldEn.contentHtml },
});

// ===== STEP 2: ปรับ section "วิสัยทัศน์" ใน contentHtml =====
// เดิมเป็น:
//   <h2>วิสัยทัศน์</h2>
//   <div class="wp-block-columns"><div class="wp-block-column">
//     <blockquote><p class="has-medium-font-size">{visionText}</p></blockquote>
//   </div></div>
//
// ใหม่: เปลี่ยนเป็น card สวย — ใส่ icon quote + gradient bg + accent border
// ตัว section h2 "วิสัยทัศน์" ใช้ class "is-style-vk-heading-plain" เดิม + เพิ่ม eyebrow "VISION" ด้านบน
// blockquote เปลี่ยนเป็น custom card

function beautifyVision(headingText, visionText, lang) {
  const eyebrow = lang === "th" ? "วิสัยทัศน์" : "VISION";
  const quoteOpenSvg = `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" style="display:block; opacity:0.15;"><path d="M6 17h3l2-4V7H5v6h3zM18 17h-3l2-4V7h-6v6h3z" fill="#003471"/></svg>`;
  return `
<div style="text-align:center; margin:0 0 16px;">
  <div style="display:inline-block; padding:4px 14px; background:linear-gradient(90deg, #003471 0%, #0066b3 100%); color:#fff; font-size:0.75rem; font-weight:600; letter-spacing:2px; border-radius:20px; text-transform:uppercase;">${eyebrow}</div>
</div>
<h2 class="has-text-align-center is-style-vk-heading-plain wp-block-heading">${headingText}</h2>



<div class="vp-vision-card" style="max-width:820px; margin:0 auto; position:relative; padding:48px 56px; background:linear-gradient(135deg, #f8fafc 0%, #eef4fb 100%); border-left:5px solid #003471; border-radius:12px; box-shadow:0 6px 24px rgba(0, 52, 113, 0.08);">
  <div style="position:absolute; top:24px; left:24px;">${quoteOpenSvg}</div>
  <p class="has-medium-font-size" style="position:relative; z-index:1; margin:0; font-size:1.35rem; line-height:1.8; color:#1f2937; font-weight:500; text-align:center; font-style:italic;">${visionText}</p>
  <div style="width:60px; height:3px; background:linear-gradient(90deg, #003471, #0066b3); margin:24px auto 0; border-radius:2px;"></div>
</div>`;
}

const items = {
  th: [
    {
      num: "01",
      title: "ยุทธศาสตร์",
      img: "/wp-content/uploads/2023/02/strategy.png",
      body: "จัดทำยุทธศาสตร์ด้านเทคโนโลยีระบบรางของประเทศเสนอต่อคณะรัฐมนตรีเพื่อพิจารณา",
    },
    {
      num: "02",
      title: "วิจัยและพัฒนา",
      img: "/wp-content/uploads/2023/02/research.png",
      body: "วิจัยและพัฒนาเทคโนโลยีระบบรางรวมทั้งสร้างนวัตกรรมเกี่ยวกับระบบราง และร่วมมือกับหน่วยงานภาครัฐและเอกชนเพื่อนำงานวิจัยและนวัตกรรมไปใช้ประโยชน์",
    },
    {
      num: "03",
      title: "มาตรฐาน",
      img: "/wp-content/uploads/2023/02/standard.png",
      body: "วิจัยและพัฒนามาตรฐานระบบรางและระบบการทดสอบด้านระบบราง ดำเนินการทดสอบด้านระบบราง และรับรองมาตรฐานและประเมินคุณภาพสำหรับใช้ประกอบการยื่นคำขอใบอนุญาตประกอบกิจการขนส่งทางราง",
    },
    {
      num: "04",
      title: "ความร่วมมือ",
      img: "/wp-content/uploads/2023/02/cooperation.png",
      body: "ร่วมมือกับหน่วยงานภาครัฐและเอกชนทั้งในประเทศและต่างประเทศ ด้านการวิจัยและนวัตกรรม และการรับ แลกเปลี่ยนถ่ายทอดและพัฒนาเทคโนโลยีระบบราง และเป็นศูนย์กลางในการรับ แลกเปลี่ยน และถ่ายทอดเทคโนโลยีระบบราง",
    },
    {
      num: "05",
      title: "พัฒนาบุคลากร",
      img: "/wp-content/uploads/2023/02/manpower.png",
      body: "พัฒนาบุคลากรด้านระบบรางและจัดให้มีการฝึกอบรมเพื่อให้การรับรองความรู้และทักษะให้แก่บุคลากรด้านระบบราง",
    },
    {
      num: "06",
      title: "ฐานข้อมูล",
      img: "/wp-content/uploads/2023/02/database.png",
      body: "จัดทำฐานข้อมูลด้านเทคโนโลยีระบบราง เพื่อรวบรวมข้อมูลเกี่ยวกับงานวิจัยและนวัตกรรม หน่วยงาน ผู้เชี่ยวชาญ และ ข้อมูลอื่นที่เกี่ยวข้องกับเทคโนโลยีระบบราง",
    },
  ],
  en: [
    {
      num: "01",
      title: "Strategy",
      img: "/wp-content/uploads/2023/02/strategy.png",
      body: "Formulating the national ‘Rail Technology Development Strategy’ and submit for approval by the cabinet.",
    },
    {
      num: "02",
      title: "Research & Development",
      img: "/wp-content/uploads/2023/02/research.png",
      body: "Research and Development of Rail Technology for supporting growth of rail transports and industries",
    },
    {
      num: "03",
      title: "Standards",
      img: "/wp-content/uploads/2023/02/standard.png",
      body: "research and develop railway system standards and testing systems, conduct railway system testing, certify standards, and evaluate quality to meet the requirements for obtaining a license to operate rail transport.",
    },
    {
      num: "04",
      title: "Cooperation",
      img: "/wp-content/uploads/2023/02/cooperation.png",
      body: "Being center of rail technology transfer and localization as well as cooperation with international partners in rail sector.",
    },
    {
      num: "05",
      title: "Developing Manpower",
      img: "/wp-content/uploads/2023/02/manpower.png",
      body: "Developing manpower for rail sector and organizing trainings for knowledge and skills in rail transport and industries",
    },
    {
      num: "06",
      title: "Data Platform",
      img: "/wp-content/uploads/2023/02/database.png",
      body: "Building rail technology data platform covering research and innovations, organizations, experts and other important rail technologies.",
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
        <img loading="lazy" decoding="async" src="${it.img}" alt="${it.title}" style="display:block; width:100%; max-width:280px; height:auto; border-radius:12px; box-shadow:0 8px 24px rgba(0, 52, 113, 0.12), 0 2px 6px rgba(0,0,0,0.08);" />
      </figure>
    </div>`;

  const contentBlock = `
    <div style="position:relative; padding:0 0 0 ${imageLeft ? "32px" : "0"}; padding-right:${imageLeft ? "0" : "32px"}; text-align:left;">
      <div style="position:absolute; top:-8px; right:${imageLeft ? "0" : "32px"}; font-size:3.5rem; line-height:1; color:#003471; opacity:0.1; font-weight:800; letter-spacing:-1px; pointer-events:none; user-select:none;">${it.num}</div>
      <h2 style="margin:0 0 12px; font-size:1.5rem; color:#003471; font-weight:700; position:relative; z-index:1;">
        <strong>${it.title}</strong>
      </h2>
      <div style="width:40px; height:2px; background:#003471; border-radius:1px; margin:0 0 16px;"></div>
      <p style="font-size:1rem; line-height:1.7; color:#374151; margin:0; max-width:520px;">${it.body}</p>
    </div>`;

  return `
<div class="vp-row" style="display:grid; align-items:center; gap:0; padding:40px 0; ${idx < items.th.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""} ${gridStyle}">
  ${imageLeft ? imageBlock + contentBlock : contentBlock + imageBlock}
</div>`;
}

function buildHtml(headingVision, visionText, headingMission, items, lang) {
  const visionBlock = beautifyVision(headingVision, visionText, lang);
  const missionEyebrow = lang === "th" ? "พันธกิจ 6 ด้าน" : "6 MISSIONS";
  const rowsHtml = items.map((it, idx) => rowHtml(it, idx)).join("");
  return `
${visionBlock}



<div style="height:56px" aria-hidden="true" class="wp-block-spacer"></div>



<div style="text-align:center; margin:0 0 16px;">
  <div style="display:inline-block; padding:4px 14px; background:linear-gradient(90deg, #003471 0%, #0066b3 100%); color:#fff; font-size:0.75rem; font-weight:600; letter-spacing:2px; border-radius:20px; text-transform:uppercase;">${missionEyebrow}</div>
</div>
<h2 class="has-text-align-center is-style-vk-heading-plain wp-block-heading">${headingMission}</h2>



<div class="vp-mission-stack" style="width:100%;">
${rowsHtml}
</div>
`;
}

const thHtml = buildHtml(
  "วิสัยทัศน์",
  "สทร.เป็นสถาบันหลักด้านการวิจัยและพัฒนาเทคโนโลยีระบบราง บูรณาการความเชี่ยวชาญและทรัพยากรจากทุกภาคส่วน เพื่อยกระดับขีดความสามารถทางเทคโนโลยีและสร้างอุตสาหกรรมระบบรางของประเทศ",
  "พันธกิจ",
  items.th,
  "th",
);

const enHtml = buildHtml(
  "Vision",
  "RTRDA becomes key rail technology R&amp;D institute to integrate expertises and resources from all stakeholders in order to upgrade technological capabilities and to build rail industry &amp; supply chain",
  "Missions",
  items.en,
  "en",
);

// ===== STEP 3: UPDATE DB =====
// clear excerpt (จะทำให้ hero-excerpt ไม่แสดง)
await p.contentRecord.update({
  where: { path: "/เกี่ยวกับ-สทร/วิสัยทัศน์-พันธกิจ" },
  data: { excerpt: "", contentHtml: thHtml, modified: new Date().toISOString() },
});
await p.contentRecord.update({
  where: { path: "/en/เกี่ยวกับ-สทร/วิสัยทัศน์-พันธกิจ" },
  data: { excerpt: "", contentHtml: enHtml, modified: new Date().toISOString() },
});

console.log("CLEARED EXCERPT + UPDATED HTML TH");
console.log("CLEARED EXCERPT + UPDATED HTML EN");
console.log("Backup saved: vision_excerpt_backup_th/en, vision_backup_v5_th/en");

await p.$disconnect();
