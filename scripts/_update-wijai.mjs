import { prisma } from "../src/lib/db/client";

async function main() {
  const rec = await prisma.contentRecord.findUnique({ where: { id: "th-page-414" } });
  if (!rec) {
    console.log("not found");
    return;
  }

  // Backup before inline edit
  await prisma.siteMeta.upsert({
    where: { key: "wijai-content-backup-v1-th" },
    update: { value: rec.contentHtml || "" },
    create: { key: "wijai-content-backup-v1-th", value: rec.contentHtml || "" },
  });
  await prisma.siteMeta.upsert({
    where: { key: "wijai-excerpt-backup-v1-th" },
    update: { value: rec.excerpt || "" },
    create: { key: "wijai-excerpt-backup-v1-th", value: rec.excerpt || "" },
  });

  // New contentHtml:
  // - keep the 3 leading h3 sections (วัตถุประสงค์, เป้าหมาย, โครงการ)
  // - rewrite "ผลงานปัจจุบัน" into 4 h4 sub-sections, each with body + images
  // - use absolute legacy WP URL for every <img>
  // - add data-lightbox so the existing YutthLightbox component wires them
  const oldContent = rec.contentHtml || "";

  // Quick sanity check — make sure we're rewriting the right record
  if (!oldContent.includes("ผลงานปัจจุบัน")) {
    console.log("contentHtml doesn't have expected anchor — aborting");
    await prisma.$disconnect();
    return;
  }

  const newContent = `

<h3 class="wp-block-heading"><strong>วัตถุประสงค์พันธกิจ</strong>&nbsp;</h3>



<p>วิจัยและพัฒนาเทคโนโลยีระบบราง รวมทั้งสร้างนวัตกรรมเกี่ยวกับระบบราง และร่วมมือกับหน่วยงานภาครัฐและเอกชน เพื่อนำงานวิจัยและนวัตกรรมไปใช้ประโยชน์&nbsp;</p>



<h3 class="wp-block-heading"><strong>เป้าหมายพันธกิจ</strong>&nbsp;</h3>



<p>เกิดงานวิจัย นวัตกรรมและเทคโนโลยีที่สร้างธุรกิจ/อุตสาหกรรมระบบรางของประเทศที่แข่งขันได้&nbsp;</p>



<h3 class="wp-block-heading"><strong>โครงการตามแผนปีงบประมาณ พ.ศ. 2566 – พ.ศ. 2567</strong>&nbsp;</h3>



<ol class="wp-block-list">
<li>โครงการยกระดับขีดความสามารถการขนส่งทางรางด้วยเทคโนโลยีสมัยใหม่&nbsp;</li>
<li>โครงการศึกษาความเหมาะสมด้านเทคโนโลยีระบบรางในอนาคตของประเทศไทย</li>
<li>โครงการพัฒนาเทคโนโลยีและนวัตกรรมเพื่อยกระดับการเดินระบบและซ่อมบำรุงระบบราง</li>
<li>โครงการวิจัยและพัฒนาวิศวกรรมโครงสร้างพื้นฐานระบบรางและส่วนประกอบ</li>
</ol>

<h3 class="wp-block-heading"><strong>ผลงานปัจจุบัน</strong></h3>

<div class="wijai-current">

<section class="wijai-item">
<h4 class="yutth-title">1. การลงพื้นที่จังหวัดอุดรธานี จังหวัดหนองคาย และ สปป.ลาว</h4>
<p>การลงพื้นที่จังหวัดอุดรธานี จังหวัดหนองคาย และ สาธารณรัฐประชาธิปไตยประชาชนลาว (สปป.ลาว) ในระหว่างวันที่ 26-27 ม.ค. 66 ร่วมกับกรมการขนส่งทางราง (ขร.) เพื่อสำรวจแนวเส้นทางการขนส่งสินค้าแบบควบคุมอุณหภูมิในระบบราง (Cold Chain Logistics) และรับรู้ถึงปัญหา และข้อจำกัดของการขนส่งสินค้าทางรางแบบควบคุมอุณหภูมิจากประเทศไทยไปยังจีน โดยผ่านเส้นทางรถไฟความเร็วสูงลาว-จีน</p>
<div class="yutth-gallery">
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/04/ข่าวที่1-2.png" alt="การลงพื้นที่ 1-2" /></figure>
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/04/ข่าวที่1-3.png" alt="การลงพื้นที่ 1-3" /></figure>
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/04/ข่าวที่1-1-709x1024.png" alt="การลงพื้นที่ 1-1" /></figure>
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/04/ข่าวที่1-6.png" alt="การลงพื้นที่ 1-6" /></figure>
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/04/ข่าวที่1-4.png" alt="การลงพื้นที่ 1-4" /></figure>
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/04/ข่าวที่1-5.png" alt="การลงพื้นที่ 1-5" /></figure>
</div>
</section>

<section class="wijai-item">
<h4 class="yutth-title">2. เข้าร่วมโครงการทดลองการใช้งาน Fuel cell สำหรับรถไฟ รฟท.</h4>
<p>เข้าร่วมโครงการทดลองการใช้งาน Fuel cell สำหรับรถไฟ รฟท. ณ สถาบันนวัตกรรม ปตท. อ.วังน้อย จ.พระนครศรีอยุธยา ในวันที่ 17 กุมภาพันธ์ 2566 นำโดย นายวัชรชาญ สิริสุวรรณทัศน์ รองผู้ว่าการรถไฟแห่งประเทศไทย และ ดร.สันติ เจริญพรพัฒนา ผอ. สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) นำคณะนักวิจัย สทร. โดยมี คุณยุทธนา สุวรรณโชติ ผู้ช่วยกรรมการผู้จัดการใหญ่ สถาบันนวัตกรรม ปตท. และทีมงานร่วมให้การต้อนรับ พร้อมนำเสนอข้อมูลการใช้พลังงานไฮโดรเจน ทั้งในและต่างประเทศ และเข้าเยี่ยมชมอาคารทดสอบต่างๆ</p>
<div class="yutth-gallery">
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/04/ข่าวที่2-1-1024x682.jpg" alt="Fuel cell 2-1" /></figure>
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/04/ข่าวที่2-2.jpg" alt="Fuel cell 2-2" /></figure>
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/04/ข่าวที่2-3-1024x651.jpg" alt="Fuel cell 2-3" /></figure>
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/04/ข่าวที่2-4-1024x682.jpg" alt="Fuel cell 2-4" /></figure>
</div>
</section>

<section class="wijai-item">
<h4 class="yutth-title">3. การสัมมนา Hydrogen Thailand symposium</h4>
<p>การสัมมนา Hydrogen Thailand symposium ณ Holiday Inn Pattaya ในวันที่ วันที่ 23 กุมภาพันธ์ 2566 ซึ่งเป็นงานที่เกิดจากความร่วมมือกันของหน่วยงานทั้งภาครัฐและเอกชน เพื่อผลักดันและเตรียมความพร้อมในการใช้พลังงานจากไฮโดรเจนและเซลล์เชื้อเพลิง ภายในงานจัดแสดงนิทรรศการ และให้สัมมนาหัวข้อที่มีความน่าสนใจเกี่ยวกับพลังงานไฮโดรเจน ทั้งในส่วนของการ ผลิต กักเก็บ การใช้ประโยชน์ และนโยบายที่ส่งเสริมให้เกิดการใช้งานอย่างเหมาะสมในต่างประเทศ</p>
<div class="yutth-gallery">
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/04/ข่าวที่3-1-1024x576.jpg" alt="Hydrogen 3-1" /></figure>
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/04/ข่าวที่3-2-1024x576.jpg" alt="Hydrogen 3-2" /></figure>
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/04/ข่าวที่3-3-1024x576.jpg" alt="Hydrogen 3-3" /></figure>
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/04/ข่าวที่3-4-1024x576.jpg" alt="Hydrogen 3-4" /></figure>
</div>
</section>

<section class="wijai-item">
<h4 class="yutth-title">4. การลงพื้นที่สำรวจแนวเส้นทางการขนส่งสินค้าแบบควบคุมอุณหภูมิในระบบราง (Cold Chain Logistics)</h4>
<p>การลงพื้นที่สำรวจแนวเส้นทางการขนส่งสินค้าแบบควบคุมอุณหภูมิในระบบราง (Cold Chain Logistics) ณ จังหวัดระยอง และจังหวัดจันทบุรี ในวันที่ 1-2 มีนาคม 2566 โดยทางทีมวิจัยฯร่วมกับกรมการขนส่งทางราง (ขร.) ได้ทำการสัมภาษณ์คุณปัญญา ปะพุธสะโร ประธานกรรมการ บริษัท เก้าเจริญ เทรน ทรานสปอร์ต จำกัด ณ สถานีรถไฟมาบตาพุด ถึงสถานการณ์ปัจจุบัน ปัญหา ข้อจำกัด และแผนในอนาคตของการขนส่งทุเรียนโดยระบบรางจากไทยไปจีน และได้เยี่ยมชมขั้นตอนการบรรจุทุเรียนในตู้ขนส่งสินค้าแบบควบคุมอุณหภูมิ</p>
<div class="yutth-gallery">
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/04/ข่าวที่4-1-1024x683.jpg" alt="ระยอง-จันทบุรี 4-1" /></figure>
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/04/ข่าวที่4-2-1024x576.jpg" alt="ระยอง-จันทบุรี 4-2" /></figure>
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/04/ข่าวที่4-3-1024x683.jpg" alt="ระยอง-จันทบุรี 4-3" /></figure>
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/04/ข่าวที่4-4-1024x576.jpg" alt="ระยอง-จันทบุรี 4-4" /></figure>
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/04/ข่าวที่4-5-1024x576.jpg" alt="ระยอง-จันทบุรี 4-5" /></figure>
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/04/ข่าวที่4-6-1024x683.jpg" alt="ระยอง-จันทบุรี 4-6" /></figure>
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/04/ข่าวที่4-7-1024x683.jpg" alt="ระยอง-จันทบุรี 4-7" /></figure>
</div>
</section>

</div>
`;

  await prisma.contentRecord.update({
    where: { id: "th-page-414" },
    data: {
      contentHtml: newContent,
      excerpt: "",
      modified: new Date().toISOString(),
    },
  });

  console.log("OK updated th-page-414");
  await prisma.$disconnect();
}
main();
