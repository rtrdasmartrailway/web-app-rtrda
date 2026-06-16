// เปลี่ยน layout "พันธกิจ" จาก 6 คอลัมน์แนวนอน เป็น 6 แถวแนวตั้ง (บนลงล่าง)
// แต่ละแถว: ภาพ (portrait) -> เส้นแบ่ง -> หัวข้อ + เลข + เนื้อหา

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

function buildHtml(headingVision, visionText, headingMission, items) {
  const rowsHtml = items
    .map(
      (it) => `
<div class="vp-row" style="padding:32px 0; border-bottom:1px solid #e5e7eb;">
  <figure class="wp-block-image" style="margin:0 0 16px;">
    <img loading="lazy" decoding="async" src="${it.img}" alt="${it.title}" style="display:block; max-width:280px; width:100%; height:auto; border-radius:4px; box-shadow:0 2px 6px rgba(0,0,0,0.08);" />
  </figure>
  <div style="width:80px; height:1px; background:#cfd6df; margin:16px 0;"></div>
  <div style="display:flex; align-items:baseline; gap:24px; margin:0 0 12px;">
    <h2 style="margin:0; font-size:1.4rem; color:#003471;"><strong>${it.title}</strong></h2>
    <h1 style="margin:0; font-size:3rem; line-height:1; color:#d1d5db; font-weight:700;">${it.num}</h1>
  </div>
  <p style="text-align:left; font-size:1rem; line-height:1.6; color:#333; margin:0; max-width:720px;">${it.body}</p>
</div>`,
    )
    .join("");

  return `
<h2 class="has-text-align-center is-style-vk-heading-plain wp-block-heading">${headingVision}</h2>



<div class="wp-block-columns is-layout-flex wp-container-core-columns-is-layout-9d6595d7 wp-block-columns-is-layout-flex">
<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow">
<blockquote class="wp-block-quote is-layout-flow wp-block-quote-is-layout-flow">
<p class="has-medium-font-size">${visionText}</p>
</blockquote>
</div>
</div>



<div style="height:40px" aria-hidden="true" class="wp-block-spacer"></div>



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
);

const enHtml = buildHtml(
  "Vision",
  "RTRDA becomes key rail technology R&amp;D institute to integrate expertises and resources from all stakeholders in order to upgrade technological capabilities and to build rail industry &amp; supply chain",
  "Missions",
  items.en,
);

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// backup current (รอบก่อนหน้า) ก่อน update
const oldTh = await p.contentRecord.findUnique({
  where: { path: "/เกี่ยวกับ-สทร/วิสัยทัศน์-พันธกิจ" },
});
const oldEn = await p.contentRecord.findUnique({
  where: { path: "/en/เกี่ยวกับ-สทร/วิสัยทัศน์-พันธกิจ" },
});

await p.siteMeta.upsert({
  where: { key: "vision_backup_v2_th" },
  update: { value: oldTh.contentHtml },
  create: { key: "vision_backup_v2_th", value: oldTh.contentHtml },
});
await p.siteMeta.upsert({
  where: { key: "vision_backup_v2_en" },
  update: { value: oldEn.contentHtml },
  create: { key: "vision_backup_v2_en", value: oldEn.contentHtml },
});

const updTh = await p.contentRecord.update({
  where: { path: "/เกี่ยวกับ-สทร/วิสัยทัศน์-พันธกิจ" },
  data: { contentHtml: thHtml, modified: new Date().toISOString() },
});
const updEn = await p.contentRecord.update({
  where: { path: "/en/เกี่ยวกับ-สทร/วิสัยทัศน์-พันธกิจ" },
  data: { contentHtml: enHtml, modified: new Date().toISOString() },
});

console.log("UPDATED TH:", updTh.id, "len:", updTh.contentHtml.length);
console.log("UPDATED EN:", updEn.id, "len:", updEn.contentHtml.length);
console.log("Backup v2 saved: vision_backup_v2_th, vision_backup_v2_en");

await p.$disconnect();
