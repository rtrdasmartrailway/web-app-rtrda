import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';

const LEGACY = 'https://www.rtrda.or.th';
const ITEMS = [
  { n: '01', title: 'ยุทธศาสตร์', icon: `${LEGACY}/wp-content/uploads/2023/02/strategy.png` },
  { n: '02', title: 'วิจัยและพัฒนา', icon: `${LEGACY}/wp-content/uploads/2023/02/research.png` },
  { n: '03', title: 'มาตรฐาน', icon: `${LEGACY}/wp-content/uploads/2023/02/standard.png` },
  { n: '04', title: 'ความร่วมมือ', icon: `${LEGACY}/wp-content/uploads/2023/02/cooperation.png` },
  { n: '05', title: 'พัฒนาบุคลากร', icon: `${LEGACY}/wp-content/uploads/2023/02/manpower.png` },
  { n: '06', title: 'ฐานข้อมูล', icon: `${LEGACY}/wp-content/uploads/2023/02/database.png` },
];
const TEXTS = {
  '01': 'จัดทำยุทธศาสตร์ด้านเทคโนโลยีระบบรางของประเทศเสนอต่อคณะรัฐมนตรีเพื่อพิจารณา',
  '02': 'วิจัยและพัฒนาเทคโนโลยีระบบรางรวมทั้งสร้างนวัตกรรมเกี่ยวกับระบบราง และร่วมมือกับหน่วยงานภาครัฐและเอกชนเพื่อนำงานวิจัยและนวัตกรรมไปใช้ประโยชน์',
  '03': 'วิจัยและพัฒนามาตรฐานระบบรางและระบบการทดสอบด้านระบบราง ดำเนินการทดสอบด้านระบบราง และรับรองมาตรฐานและประเมินคุณภาพสำหรับใช้ประกอบการยื่นคำขอใบอนุญาตประกอบกิจการขนส่งทางราง',
  '04': 'ร่วมมือกับหน่วยงานภาครัฐและเอกชนทั้งในประเทศและต่างประเทศ ด้านการวิจัยและนวัตกรรม และการรับ แลกเปลี่ยนถ่ายทอดและพัฒนาเทคโนโลยีระบบราง และเป็นศูนย์กลางในการรับ แลกเปลี่ยน และถ่ายทอดเทคโนโลยีระบบราง',
  '05': 'พัฒนาบุคลากรด้านระบบรางและจัดให้มีการฝึกอบรมเพื่อให้การรับรองความรู้และทักษะให้แก่บุคลากรด้านระบบราง',
  '06': 'จัดทำฐานข้อมูลด้านเทคโนโลยีระบบราง เพื่อรวบรวมข้อมูลเกี่ยวกับงานวิจัยและนวัตกรรม หน่วยงาน ผู้เชี่ยวชาญ และ ข้อมูลอื่นที่เกี่ยวข้องกับเทคโนโลยีระบบราง',
};

// Collage 2x3 grid of icons (left column)
const collageHtml = `
<div class="vision-collage">
  ${ITEMS.map(
    ({ icon, title }) => `
  <div class="vision-collage-cell">
    <img src="${icon}" alt="${title}" loading="lazy" decoding="async">
  </div>`,
  ).join('')}
</div>`;

// Numbered list (right column) — matches the mockup style:
// big blue number + bold title + normal text, separated by dashed blue line
const listHtml = `
<ol class="vision-list">
  ${ITEMS.map(
    ({ n, title }) => `
  <li class="vision-list-item">
    <span class="vision-list-num">${n}</span>
    <div class="vision-list-content">
      <h4 class="vision-list-title">${title}</h4>
      <p class="vision-list-text">${TEXTS[n]}</p>
    </div>
  </li>`,
  ).join('')}
</ol>`;

const newHtml = `
<h2 class="has-text-align-center is-style-vk-heading-plain wp-block-heading">วิสัยทัศน์</h2>



<div class="wp-block-columns is-layout-flex wp-container-core-columns-is-layout-9d6595d7 wp-block-columns-is-layout-flex">
<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow">
<blockquote class="wp-block-quote is-layout-flow wp-block-quote-is-layout-flow">
<p class="has-medium-font-size">สทร.เป็นสถาบันหลักด้านการวิจัยและพัฒนาเทคโนโลยีระบบราง บูรณาการความเชี่ยวชาญและทรัพยากรจากทุกภาคส่วน เพื่อยกระดับขีดความสามารถทางเทคโนโลยีและสร้างอุตสาหกรรมระบบรางของประเทศ</p>
</blockquote>
</div>
</div>



<div style="height:40px" aria-hidden="true" class="wp-block-spacer"></div>



<h2 class="has-text-align-center is-style-vk-heading-plain wp-block-heading">พันธกิจ</h2>



<div class="vision-infographic">
  <div class="vision-banner">พันธกิจ 6 ด้านของ สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง</div>
  <div class="vision-infographic-body">
    ${collageHtml}
    ${listHtml}
  </div>
</div>
`.trim();

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const r = await p.contentRecord.findUnique({
  where: { path: '/เกี่ยวกับ-สทร/วิสัยทัศน์-พันธกิจ' },
});
if (!r) { console.error('not found'); process.exit(1); }
await p.contentRecord.update({
  where: { path: '/เกี่ยวกับ-สทร/วิสัยทัศน์-พันธกิจ' },
  data: { contentHtml: newHtml, modified: new Date().toISOString() },
});
console.log('UPDATED. new length:', newHtml.length);
await p.$disconnect();
