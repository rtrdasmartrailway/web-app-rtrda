import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const LEGACY = "https://www.rtrda.or.th";
const PATH = "/ผลงานและโครงการเด่น/วิจัย-นวัตกรรม";

// All `/wp-content/uploads/2023/04/ข่าวที่N-M.*` files are missing from
// the local Docker image (per the rtrda-web-app skill). Hot-link to
// the legacy WP at https://www.rtrda.or.th instead.
//
// Each event = 1 ol item (from the original content) + its gallery of
// images grouped 2x2. We re-organize the 4 events from the source:
//
// Event 1 (ol #1): 6 images (1-1..1-6)   — split into 3 rows of 2
// Event 2 (ol #2): 4 images (2-1..2-4)   — 2 rows of 2
// Event 3 (ol #3): 4 images (3-1..3-4)   — 2 rows of 2
// Event 4 (ol #4): 7 images (4-1..4-7)   — 4 rows of 2 (last is single)

const EVENTS = [
  {
    n: "1",
    text: "การลงพื้นที่จังหวัดอุดรธานี จังหวัดหนองคาย และ สาธารณรัฐประชาธิปไตยประชาชนลาว (สปป.ลาว) ในระหว่างวันที่ 26-27 ม.ค. 66 ร่วมกับกรมการขนส่งทางราง (ขร.) เพื่อสำรวจแนวเส้นทางการขนส่งสินค้าแบบควบคุมอุณหภูมิในระบบราง (Cold Chain Logistics) และรับรู้ถึงปัญหา และข้อจำกัดของการขนส่งสินค้าทางรางแบบควบคุมอุณหภูมิจากประเทศไทยไปยังจีน โดยผ่านเส้นทางรถไฟความเร็วสูงลาว-จีน",
    imgs: [
      "ข่าวที่1-1-709x1024.png",
      "ข่าวที่1-2.png",
      "ข่าวที่1-3.png",
      "ข่าวที่1-6.png",
    ],
  },
  {
    n: "2",
    text: "เข้าร่วมโครงการทดลองการใช้งาน Fuel cell สำหรับรถไฟ รฟท. ณ สถาบันนวัตกรรม ปตท. อ.วังน้อย จ.พระนครศรีอยุธยา ในวันที่ 17 กุมภาพันธ์ 2566 นำโดย นายวัชรชาญ สิริสุวรรณทัศน์ รองผู้ว่าการรถไฟแห่งประเทศไทย และ ดร.สันติ เจริญพรพัฒนา ผอ. สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) นำคณะนักวิจัย สทร. โดยมี คุณยุทธนา สุวรรณโชติ ผู้ช่วยกรรมการผู้จัดการใหญ่ สถาบันนวัตกรรม ปตท. และทีมงานร่วมให้การต้อนรับ พร้อมนำเสนอข้อมูลการใช้พลังงานไฮโดรเจน ทั้งในและต่างประเทศ และเข้าเยี่ยมชมอาคารทดสอบต่างๆ",
    imgs: [
      "ข่าวที่2-1-1024x682.jpg",
      "ข่าวที่2-2.jpg",
      "ข่าวที่2-3-1024x651.jpg",
      "ข่าวที่2-4-1024x682.jpg",
    ],
  },
  {
    n: "3",
    text: "การสัมมนา Hydrogen Thailand symposium ณ Holiday Inn Pattaya ในวันที่ วันที่ 23 กุมภาพันธ์ 2566 ซึ่งเป็นงานที่เกิดจากความร่วมมือกันของหน่วยงานทั้งภาครัฐและเอกชน เพื่อผลักดันและเตรียมความพร้อมในการใช้พลังงานจากไฮโดรเจนและเซลล์เชื้อเพลิง ภายในงานจัดแสดงนิทรรศการ และให้สัมมนาหัวข้อที่มีความน่าสนใจเกี่ยวกับพลังงานไฮโดรเจน ทั้งในส่วนของการ ผลิต กักเก็บ การใช้ประโยชน์ และนโยบายที่ส่งเสริมให้เกิดการใช้งานอย่างเหมาะสมในต่างประเทศ",
    imgs: [
      "ข่าวที่3-1-1024x576.jpg",
      "ข่าวที่3-2-1024x576.jpg",
      "ข่าวที่3-3-1024x576.jpg",
      "ข่าวที่3-4-1024x576.jpg",
    ],
  },
  {
    n: "4",
    text: "การลงพื้นที่สำรวจแนวเส้นทางการขนส่งสินค้าแบบควบคุมอุณหภูมิในระบบราง (Cold Chain Logistics) ณ จังหวัดระยอง และจังหวัดจันทบุรี ในวันที่ 1-2 มีนาคม 2566 โดยทางทีมวิจัยฯร่วมกับกรมการขนส่งทางราง (ขร.) ได้ทำการสัมภาษณ์คุณปัญญา ปะพุธสะโร ประธานกรรมการ บริษัท เก้าเจริญ เทรน ทรานสปอร์ต จำกัด ณ สถานีรถไฟมาบตาพุด ถึงสถานการณ์ปัจจุบัน ปัญหา ข้อจำกัด และแผนในอนาคตของการขนส่งทุเรียนโดยระบบรางจากไทยไปจีน และได้เยี่ยมชมขั้นตอนการบรรจุทุเรียนในตู้ขนส่งสินค้าแบบควบคุมอุณหภูมิ",
    imgs: [
      "ข่าวที่4-1-1024x683.jpg",
      "ข่าวที่4-2-1024x576.jpg",
      "ข่าวที่4-3-1024x683.jpg",
      "ข่าวที่4-4-1024x576.jpg",
    ],
  },
];

const eventsHtml = EVENTS.map(
  (e) => `
<div class="yutth-event">
  <div class="yutth-event-header">
    <span class="yutth-event-num">${e.n}</span>
    <h4 class="yutth-event-title">กิจกรรมที่ ${e.n}</h4>
  </div>
  <p class="yutth-event-text">${e.text}</p>
  <div class="yutth-event-gallery">
    ${e.imgs
      .map(
        (img) => `
    <figure class="yutth-event-cell">
      <img src="${LEGACY}/wp-content/uploads/2023/04/${img}" alt="ภาพกิจกรรม ${e.n} - ${img}" loading="lazy" decoding="async">
    </figure>`,
      )
      .join("")}
  </div>
</div>`,
).join("\n");

const newHtml = `
<h3 class="wp-block-heading"><strong>วัตถุประสงค์พันธกิจ</strong></h3>



<p>วิจัยและพัฒนาเทคโนโลยีระบบราง รวมทั้งสร้างนวัตกรรมเกี่ยวกับระบบราง และร่วมมือกับหน่วยงานภาครัฐและเอกชน เพื่อนำงานวิจัยและนวัตกรรมไปใช้ประโยชน์&nbsp;</p>



<h3 class="wp-block-heading"><strong>เป้าหมายพันธกิจ</strong></h3>



<p>เกิดงานวิจัย นวัตกรรมและเทคโนโลยีที่สร้างธุรกิจ/อุตสาหกรรมระบบรางของประเทศที่แข่งขันได้&nbsp;</p>



<h3 class="wp-block-heading"><strong>โครงการตามแผนปีงบประมาณ พ.ศ. 2566 – พ.ศ. 2567</strong></h3>



<ol class="wp-block-list">
<li>โครงการยกระดับขีดความสามารถการขนส่งทางรางด้วยเทคโนโลยีสมัยใหม่&nbsp;</li>
<li>โครงการศึกษาความเหมาะสมด้านเทคโนโลยีระบบรางในอนาคตของประเทศไทย</li>
<li>โครงการพัฒนาเทคโนโลยีและนวัตกรรมเพื่อยกระดับการเดินระบบและซ่อมบำรุงระบบราง</li>
<li>โครงการวิจัยและพัฒนาวิศวกรรมโครงสร้างพื้นฐานระบบรางและส่วนประกอบ</li>
</ol>



<h3 class="wp-block-heading"><strong>ผลงานปัจจุบัน</strong></h3>



${eventsHtml}
`.trim();

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const r = await p.contentRecord.findUnique({ where: { path: PATH } });
if (!r) {
  console.error("not found:", PATH);
  process.exit(1);
}
await p.contentRecord.update({
  where: { path: PATH },
  data: { contentHtml: newHtml, modified: new Date().toISOString() },
});
console.log("UPDATED. new length:", newHtml.length);
await p.$disconnect();
