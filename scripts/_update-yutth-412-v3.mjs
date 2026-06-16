import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';

const LEGACY = 'https://www.rtrda.or.th';
const PATH = '/ผลงานและโครงการเด่น/ยุทธศาสตร์-เทคโนโลยี-ระบ';

// Structure requested by user:
// 1) Section numbers on the 3 preceding headings (01, 02, 03)
// 2) ผลงานปัจจุบัน = เนื้อหา ol (รายการ) on top, then strategy.png
//    (main image), then 2x2 gallery of 1.png/2.png/3.png/4.jpg
const newHtml = `
<h3 class="wp-block-heading yutth-section-heading"><span class="yutth-section-num">01</span>วัตถุประสงค์พันธกิจ</h3>



<p>จัดทำยุทธศาสตร์ด้านเทคโนโลยีระบบรางของประเทศเสนอต่อคณะรัฐมนตรี&nbsp;</p>



<h3 class="wp-block-heading yutth-section-heading"><span class="yutth-section-num">02</span>เป้าหมายพันธกิจ</h3>



<p>เพื่อกำหนดแนวทางการขับเคลื่อนการพัฒนาเทคโนโลยีและระบบนิเวศอุตสาหกรรมของระบบรางร่วมกันกับผู้มีส่วนได้ส่วนเสียตามยุทธศาสตร์ที่จัดทำขึ้น รวมถึงออกแบบตัวแบบการพัฒนา (Development Model) ทางเศรษฐกิจและการพัฒนาเชิงพื้นที่ศูนย์กลางระบบรางในแต่ละภูมิภาค และศึกษาแนวทางการพัฒนาห่วงโซ่อุปทาน (Supply Chain) ของอุตสาหกรรมระบบรางเพื่อให้เกิด Local Content อย่างยั่งยืน&nbsp;</p>



<h3 class="wp-block-heading yutth-section-heading"><span class="yutth-section-num">03</span>โครงการตามแผนปีงบประมาณ พ.ศ. 2566 – พ.ศ. 2567</h3>



<p>โครงการที่ 1 โครงการจัดทำยุทธศาสตร์ด้านเทคโนโลยีระบบรางของประเทศ&nbsp;</p>



<p>โครงการที่ 2 โครงการจัดทำข้อเสนอเชิงนโยบายในการยกระดับเศรษฐกิจในภูมิภาคด้วยระบบราง&nbsp;</p>



<h3 class="wp-block-heading yutth-section-heading"><span class="yutth-section-num">04</span>ผลงานปัจจุบัน</h3>



<div class="yutth-current">

  <ol class="yutth-list">
    <li>ที่ประชุมคณะกรรมการดำเนินงานความร่วมมือฯ ครั้งที่ 1/2566 เมื่อวันอังคารที่ 28 กุมภาพันธ์ 2566 มีมติเห็นชอบหลักการและความก้าวหน้าการดำเนินงานโครงการจัดทำยุทธศาสตร์ด้านเทคโนโลยีระบบรางของประเทศ</li>
    <li>ศึกษาภาคสนามในพื้นที่ศักยภาพเป็นศูนย์กลางระบบราง ได้แก่ จังหวัดขอนแก่น พื้นที่การค้าชายแดนจังหวัดหนองคาย ศูนย์กระจายสินค้าผลไม้จังหวัดระยองและจันทบุรี</li>
    <li>สำรวจข้อมูลด้านการขนส่งสินค้าผ่านแดนรูปแบบต่างๆ เชื่อมต่อระหว่างแนว Belt Road Initiative เข้ากับเขตเศรษฐกิจในประเทศไทย และจัดทำบทวิเคราะห์ด้านการส่งเสริมการค้าชายแดนด้วยระบบราง</li>
    <li>จัดทำบทวิเคราะห์เกี่ยวกับการพัฒนาการขนส่งสินค้าประเภทยางพารา และการขนส่งสินค้าแบบควบคุมอุณหภูมิ</li>
  </ol>

  <figure class="wp-block-image size-full is-style-vk-image-photoFrame yutth-feature-img">
    <img loading="lazy" decoding="async" width="365" height="205"
         src="${LEGACY}/wp-content/uploads/2023/03/strategy.png"
         alt="แผนที่ยุทธศาสตร์ด้านเทคโนโลยีระบบราง"
         class="wp-image-1473">
    <figcaption class="yutth-feature-caption">แผนที่ยุทธศาสตร์ด้านเทคโนโลยีระบบรางของประเทศ</figcaption>
  </figure>

  <div class="yutth-gallery-grid">
    <figure class="wp-block-image size-full is-style-vk-image-photoFrame yutth-gallery-cell">
      <img loading="lazy" decoding="async" width="493" height="331"
           src="${LEGACY}/wp-content/uploads/2023/03/1.png"
           alt="ภาพกิจกรรม 1"
           class="wp-image-1472">
    </figure>
    <figure class="wp-block-image size-full is-style-vk-image-photoFrame yutth-gallery-cell">
      <img loading="lazy" decoding="async" width="452" height="297"
           src="${LEGACY}/wp-content/uploads/2023/03/2.png"
           alt="ภาพกิจกรรม 2"
           class="wp-image-1471">
    </figure>
    <figure class="wp-block-image size-full is-style-vk-image-photoFrame yutth-gallery-cell">
      <img loading="lazy" decoding="async" width="430" height="490"
           src="${LEGACY}/wp-content/uploads/2023/03/3.png"
           alt="ภาพกิจกรรม 3"
           class="wp-image-1470">
    </figure>
    <figure class="wp-block-image size-full is-style-vk-image-photoFrame yutth-gallery-cell">
      <img loading="lazy" decoding="async" width="616" height="358"
           src="${LEGACY}/wp-content/uploads/2023/03/4.jpg"
           alt="ภาพกิจกรรม 4"
           class="wp-image-1469">
    </figure>
  </div>

</div>
`.trim();

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const r = await p.contentRecord.findUnique({ where: { path: PATH } });
if (!r) { console.error('not found:', PATH); process.exit(1); }
await p.contentRecord.update({
  where: { path: PATH },
  data: { contentHtml: newHtml, modified: new Date().toISOString() },
});
console.log('UPDATED. new length:', newHtml.length);
await p.$disconnect();
