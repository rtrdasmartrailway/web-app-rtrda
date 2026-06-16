import { prisma } from "../src/lib/db/client";

async function main() {
  const rec = await prisma.contentRecord.findUnique({ where: { id: "th-page-412" } });
  if (!rec) {
    console.log("not found");
    return;
  }

  // Backup before inline edit (DB-side, no git)
  await prisma.siteMeta.upsert({
    where: { key: "yutth-phon-content-backup-v1-th" },
    update: { value: rec.contentHtml || "" },
    create: { key: "yutth-phon-content-backup-v1-th", value: rec.contentHtml || "" },
  });
  await prisma.siteMeta.upsert({
    where: { key: "yutth-phon-excerpt-backup-v1-th" },
    update: { value: rec.excerpt || "" },
    create: { key: "yutth-phon-excerpt-backup-v1-th", value: rec.excerpt || "" },
  });

  // Keep the first 4 sections (up to <h3>ผลงานปัจจุบัน</h3> inclusive) and
  // replace the two card blocks with 4 numbered sub-headings + a gallery.
  const newContent = `
<h3 class="wp-block-heading"><strong>วัตถุประสงค์พันธกิจ</strong>&nbsp;</h3>



<p>จัดทำยุทธศาสตร์ด้านเทคโนโลยีระบบรางของประเทศเสนอต่อคณะรัฐมนตรี&nbsp;</p>



<h3 class="wp-block-heading"><strong>เป้าหมายพันธกิจ</strong>&nbsp;</h3>



<p>เพื่อกำหนดแนวทางการขับเคลื่อนการพัฒนาเทคโนโลยีและระบบนิเวศอุตสาหกรรมของระบบรางร่วมกันกับผู้มีส่วนได้ส่วนเสียตามยุทธศาสตร์ที่จัดทำขึ้น รวมถึงออกแบบตัวแบบการพัฒนา (Development Model) ทางเศรษฐกิจและการพัฒนาเชิงพื้นที่ศูนย์กลางระบบรางในแต่ละภูมิภาค และศึกษาแนวทางการพัฒนาห่วงโซ่อุปทาน (Supply Chain) ของอุตสาหกรรมระบบรางเพื่อให้เกิด Local Content อย่างยั่งยืน&nbsp;</p>



<h3 class="wp-block-heading"><strong>โครงการตามแผนปีงบประมาณ พ.ศ. 2566 – พ.ศ. 2567</strong>&nbsp;</h3>



<p>โครงการที่ 1 โครงการจัดทำยุทธศาสตร์ด้านเทคโนโลยีระบบรางของประเทศ&nbsp;</p>



<p>โครงการที่ 2 โครงการจัดทำข้อเสนอเชิงนโยบายในการยกระดับเศรษฐกิจในภูมิภาคด้วยระบบราง&nbsp;</p>



<h3 class="wp-block-heading"><strong>ผลงานปัจจุบัน</strong>&nbsp;</h3>



<div class="yutth-current">
<ol class="yutth-list">
<li>
  <span class="yutth-num">1</span>
  <div class="yutth-body">
    <h4 class="yutth-title">คณะกรรมการดำเนินงานความร่วมมือฯ ครั้งที่ 1/2566</h4>
    <p>ที่ประชุมเมื่อวันอังคารที่ 28 กุมภาพันธ์ 2566 มีมติเห็นชอบหลักการและความก้าวหน้าการดำเนินงานโครงการจัดทำยุทธศาสตร์ด้านเทคโนโลยีระบบรางของประเทศ</p>
  </div>
</li>
<li>
  <span class="yutth-num">2</span>
  <div class="yutth-body">
    <h4 class="yutth-title">ศึกษาภาคสนามในพื้นที่ศักยภาพ</h4>
    <p>สำรวจพื้นที่เป้าหมายที่จะเป็นศูนย์กลางระบบราง ได้แก่ จังหวัดขอนแก่น พื้นที่การค้าชายแดนจังหวัดหนองคาย ศูนย์กระจายสินค้าผลไม้จังหวัดระยองและจันทบุรี</p>
  </div>
</li>
<li>
  <span class="yutth-num">3</span>
  <div class="yutth-body">
    <h4 class="yutth-title">สำรวจข้อมูลการขนส่งสินค้าผ่านแดน</h4>
    <p>เชื่อมต่อระหว่างแนว Belt Road Initiative เข้ากับเขตเศรษฐกิจในประเทศไทย พร้อมจัดทำบทวิเคราะห์ด้านการส่งเสริมการค้าชายแดนด้วยระบบราง</p>
  </div>
</li>
<li>
  <span class="yutth-num">4</span>
  <div class="yutth-body">
    <h4 class="yutth-title">บทวิเคราะห์การขนส่งสินค้าเฉพาะกลุ่ม</h4>
    <p>จัดทำบทวิเคราะห์เกี่ยวกับการพัฒนาการขนส่งสินค้าประเภทยางพารา และการขนส่งสินค้าแบบควบคุมอุณหภูมิ</p>
  </div>
</li>
</ol>

<div class="yutth-gallery">
<figure class="yutth-feature"><img loading="lazy" decoding="async" data-lightbox="yutth" data-caption="หลักการบริหารยุทธศาสตร์ด้านเทคโนโลยีระบบรางของประเทศ (5 หลักการ)" src="https://www.rtrda.or.th/wp-content/uploads/2023/03/strategy.png" alt="หลักการบริหารยุทธศาสตร์ด้านเทคโนโลยีระบบรางของประเทศ" /></figure>
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/03/1.png" alt="คณะกรรมการดำเนินงานความร่วมมือฯ ครั้งที่ 1/2566" /></figure>
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/03/2.png" alt="ภาพกิจกรรมภาคสนาม" /></figure>
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/03/4.jpg" alt="ภาพการสำรวจข้อมูลขนส่งสินค้า" /></figure>
<figure><img loading="lazy" decoding="async" data-lightbox="yutth" src="https://www.rtrda.or.th/wp-content/uploads/2023/03/3.png" alt="ภาพการวิเคราะห์ขนส่งสินค้า" /></figure>
</div>
</div>
`;

  await prisma.contentRecord.update({
    where: { id: "th-page-412" },
    data: {
      contentHtml: newContent,
      modified: new Date().toISOString(),
    },
  });

  console.log("OK updated th-page-412");
  await prisma.$disconnect();
}
main();
