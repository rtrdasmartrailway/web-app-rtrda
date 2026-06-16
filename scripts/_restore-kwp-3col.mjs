import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const path = "/เกี่ยวกับ-สทร/ความเป็นมา";

// Restore excerpt
const excerptBackup = await p.siteMeta.findUnique({
  where: { key: "kwp_excerpt_backup_v1_th" },
});
if (excerptBackup?.value) {
  await p.contentRecord.update({
    where: { path },
    data: { excerpt: excerptBackup.value },
  });
  console.log("EXCERPT RESTORED");
} else {
  console.log("No excerpt backup");
}

// Get current content (without strategy-1 column)
const r = await p.contentRecord.findUnique({ where: { path } });
if (!r) {
  console.log("NOT FOUND");
  process.exit(1);
}

let html = r.contentHtml;
const before = html.length;

// Backup current (2 columns version)
await p.siteMeta.upsert({
  where: { key: "kwp_backup_2cols_th" },
  update: { value: html },
  create: { key: "kwp_backup_2cols_th", value: html },
});

// Build new 3-card layout (replaces existing columns block)
const newColumnsBlock = `<div class="wp-block-columns story is-layout-flex wp-container-core-columns-is-layout-9d6595d7 wp-block-columns-is-layout-flex">
<div class="wp-block-column is-vertically-aligned-top is-layout-flow wp-block-column-is-layout-flow">
<figure class="wp-block-image size-full"><img loading="lazy" decoding="async" width="64" height="64" src="/wp-content/uploads/2023/02/strategy-1.png" alt="ยุทธศาสตร์ชาติ" class="wp-image-1113"></figure>


<p>ยุทธศาสตร์ชาติระยะ 20 ปี ของรัฐบาล ได้เน้นการพัฒนาระบบคมนาคมขนส่งทางรางให้เป็นแกนหลักด้านการคมนาคมของประเทศ เพื่อเพิ่มขีดความสามารถในการแข่งขันทางเศรษฐกิจ และยกระดับคุณภาพชีวิตของประชาชน</p>
</div>



<div class="wp-block-column is-vertically-aligned-top is-layout-flow wp-block-column-is-layout-flow">
<figure class="wp-block-image size-full"><img loading="lazy" decoding="async" width="64" height="64" src="/wp-content/uploads/2023/02/mining.png" alt="กระทรวงคมนาคม" class="wp-image-1112"></figure>


<p>กระทรวงคมนาคม จึงได้เร่งรัดการพัฒนาระบบรางมาอย่างต่อเนื่อง ทั้งการพัฒนารถไฟฟ้าขนส่งมวลชน รถไฟทางไกลระหว่างเมือง และรถไฟความเร็วสูง</p>
</div>



<div class="wp-block-column is-vertically-aligned-top is-layout-flow wp-block-column-is-layout-flow">
<figure class="wp-block-image size-full"><img loading="lazy" decoding="async" width="64" height="64" src="/wp-content/uploads/2023/02/team.png" alt="การจัดตั้ง สทร." class="wp-image-1114"></figure>


<p>ด้วยเห็นความสำคัญจำเป็นของประเทศ ที่จะมีการขยายโครงสร้างพื้นฐานระบบรางไปทั่วประเทศ และเพื่อให้มีการดำเนินงานทางยุทธศาสตร์การพัฒนาทางเทคโนโลยีที่เป็นไปในทิศทางเดียวกัน กระทรวงคมนาคมจึงได้จัดตั้ง สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) ขึ้นเพื่อตอบสนองความต้องการของประเทศดังกล่าว โดยได้จัดตั้งขึ้นเมื่อวันที่ 14 กรกฎาคม 2564</p>
</div>
</div>`;

// Find and replace the existing 2-column block
// Match from <div class="wp-block-columns story..." to its </div> closing
const colRe = new RegExp(
  '<div class="wp-block-columns story[^"]*">.*?</div>\\s*</div>\\s*</div></div></div></article>',
  "s",
);

// We'll insert our new 3-column block before the </div> closing of the content area
// Find: <div class="wp-content">...</div>  -- we'll insert before footer
// Easier: find the spacer before the columns block and insert after
// Actually, the structure is:
//   <div class="wp-block-spacer"></div>
//   <div class="wp-block-columns story...">...</div>
// We have 2 cols, want 3 cols.

// Strategy: find the existing 2-col block (which contains mining.png + team.png)
// and replace it with the 3-col block

const twoColRe = new RegExp(
  '<div class="wp-block-columns story is-layout-flex wp-container-core-columns-is-layout-9d6595d7 wp-block-columns-is-layout-flex">' +
    '\\s*<div class="wp-block-column is-vertically-aligned-top is-layout-flow wp-block-column-is-layout-flow">' +
    ".*?</div>\\s*</div>",
  "s",
);

const match = html.match(twoColRe);
if (!match) {
  console.log("2-COL BLOCK NOT MATCHED");
  process.exit(1);
}
console.log("Matched 2-col block, length:", match[0].length);

const newHtml = html.replace(twoColRe, newColumnsBlock);
console.log("Before:", before);
console.log("After:", newHtml.length);

await p.contentRecord.update({
  where: { path },
  data: { contentHtml: newHtml, modified: new Date().toISOString() },
});

console.log("UPDATED TH — restored 3-card layout");

await p.$disconnect();
