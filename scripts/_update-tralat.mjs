import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';

const LEGACY = 'https://www.rtrda.or.th';
const PATH = '/เกี่ยวกับ-สทร/ตราสัญลักษณ์-สทร';

const newHtml = `
<figure class="wp-block-image size-full is-style-vk-image-shadow tralat-hero">
  <img
    loading="lazy"
    decoding="async"
    src="${LEGACY}/wp-content/uploads/2023/03/Logo_RTRDA_full-en.jpg"
    alt="ตราสัญลักษณ์ สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน)"
    class="wp-image-tralat-hero"
  />
</figure>


<h2 class="has-text-align-center is-style-vk-heading-plain wp-block-heading">ความหมายของตราสัญลักษณ์</h2>



<div class="wp-block-columns is-layout-flex wp-container-core-columns-is-layout-9d6595d7 wp-block-columns-is-layout-flex">
<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow" style="flex-basis:100%">
<p><strong>ตราสัญลักษณ์ สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน)</strong> หรือ <strong>สทร.</strong> ได้รับการจัดทำขึ้นตามประกาศคณะกรรมการสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง เรื่อง เครื่องหมายของสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) พ.ศ. 2565 เพื่อใช้เป็นสัญลักษณ์ประจำองค์กรในการสื่อสารและประชาสัมพันธ์ภารกิจของ สทร. ต่อสาธารณชน</p>
<p>ตราสัญลักษณ์สะท้อนถึงอัตลักษณ์ขององค์กรที่มุ่งเน้นการวิจัยและพัฒนาเทคโนโลยีระบบราง เพื่อยกระดับขีดความสามารถด้านเทคโนโลยีและสนับสนุนอุตสาหกรรมระบบรางของประเทศไทยอย่างยั่งยืน</p>
</div>
</div>



<div style="height:24px" aria-hidden="true" class="wp-block-spacer"></div>



<h2 class="has-text-align-center is-style-vk-heading-plain wp-block-heading">ดาวน์โหลดตราสัญลักษณ์</h2>



<figure class="wp-block-table is-style-vk-table-border-stripes tralat-download-table">
<table>
<colgroup>
  <col style="width:90px" />
  <col style="width:auto" />
  <col style="width:200px" />
</colgroup>
<thead>
<tr>
  <th>รูปแบบ</th>
  <th>รายการ</th>
  <th class="tralat-download-th">ดาวน์โหลด</th>
</tr>
</thead>
<tbody>
<tr>
  <td><img loading="lazy" decoding="async" width="50" height="50" class="tralat-icon" src="${LEGACY}/wp-content/uploads/2023/04/pdf.png" alt="ไฟล์ PDF"></td>
  <td>ประกาศคณะกรรมการสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง เรื่อง เครื่องหมายของสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) พ.ศ. 2565</td>
  <td><a href="${LEGACY}/wp-content/uploads/2023/04/เครื่องหมายของสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง-องค์การมหาชน-พ.ศ.2565.pdf" target="_blank" rel="noreferrer noopener" class="tralat-download-link"><span class="text-nowrap">ดาวน์โหลด PDF</span></a></td>
</tr>
<tr>
  <td><img loading="lazy" decoding="async" width="50" height="50" class="tralat-icon" src="${LEGACY}/wp-content/uploads/2023/04/png-1.png" alt="ไฟล์ PNG"></td>
  <td>ตราสัญลักษณ์ สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน)</td>
  <td><a href="${LEGACY}/wp-content/uploads/2024/12/Logo_RTRDA_En_Color.zip" target="_blank" rel="noopener" class="tralat-download-link"><span class="text-nowrap">ดาวน์โหลด ไฟล์ PNG</span></a></td>
</tr>
<tr>
  <td><img loading="lazy" decoding="async" width="50" height="50" class="tralat-icon" src="${LEGACY}/wp-content/uploads/2023/04/ai.png" alt="ไฟล์ AI"></td>
  <td>ตราสัญลักษณ์ สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน)</td>
  <td><a href="${LEGACY}/wp-content/uploads/2024/12/LogoRTRDA_ENGTHAI.zip" target="_blank" rel="noopener" class="tralat-download-link">ดาวน์โหลด ไฟล์ AI</a></td>
</tr>
</tbody>
</table>
</figure>
<p> </p>
`.trim();

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const r = await p.contentRecord.findFirst({
  where: { path: PATH, language: 'th' },
});
if (!r) { console.error('not found:', PATH); process.exit(1); }
await p.contentRecord.update({
  where: { path: PATH },
  data: { contentHtml: newHtml, modified: new Date().toISOString() },
});
console.log('UPDATED. new length:', newHtml.length);
console.log('PATH:', r.path);
await p.$disconnect();
