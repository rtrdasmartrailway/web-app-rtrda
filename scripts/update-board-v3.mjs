// ปรับหน้า "คณะกรรมการและผู้บริหาร" v3
// - Org chart layout 4 ระดับ (1 → 3 → 6 → 2) ไม่มีเส้น
// - ข้อมูลล่าสุด (refresh จาก production)
// - ปุ่ม "รายละเอียด" เปิด modal

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { readFileSync } from "fs";

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Load latest prod data
const peopleProd = JSON.parse(readFileSync("/tmp/people-prod-latest.json", "utf-8"));
const slugMapping = JSON.parse(readFileSync("/tmp/slug-to-modal.json", "utf-8"));
const modals = JSON.parse(readFileSync("/tmp/people-modals.json", "utf-8"));

// Save latest modals to SiteMeta
const allModalsById = {};
for (const [pid, data] of Object.entries(modals)) {
  allModalsById[pid] = data.content_html;
}
await p.siteMeta.upsert({
  where: { key: "board_modals_v3" },
  update: { value: allModalsById },
  create: { key: "board_modals_v3", value: allModalsById },
});

// Backup v2
const oldTh = await p.contentRecord.findUnique({
  where: { path: "/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร" },
});
await p.siteMeta.upsert({
  where: { key: "board_backup_v3_th" },
  update: { value: oldTh.contentHtml },
  create: { key: "board_backup_v3_th", value: oldTh.contentHtml },
});

// FALLBACK_IMG (same as v1/v2)
const FALLBACK_IMG = {
  "/wp-content/uploads/2025/06/พัฒนพงษ์.jpg":
    "/wp-content/uploads/2023/02/06_พัฒนพงษ์-.png",
  "/wp-content/uploads/2025/06/เพียงออ.jpg":
    "/wp-content/uploads/2023/02/04_ดร.เพียงออ-.png",
  "/wp-content/uploads/2025/06/จุลเทพ2.jpg": null,
  "/wp-content/uploads/2024/10/ตราเครื่องหมายราชการแห่งกระทรวง_อว.png": null,
  "/wp-content/uploads/2025/10/ดร.กิติพันธุ์-นุตยกุล-ผู้จัดการกลุ่มวิจัยและมาตรฐาน.jpg":
    null,
  "/wp-content/uploads/2025/10/ชัยวุฒิ-ตันไชย-ผู้จัดการกลุ่มพัฒนาผู้ประกอบการและธุรกิจใหม่.jpg":
    null,
  "/wp-content/uploads/2025/10/ชัชวาล-พานวงษ์-ผู้จัดการกลุ่มพัฒนาดิจิทัลระบบราง.jpg":
    null,
  "/wp-content/uploads/2024/05/IMG_2233.png": null,
  "/wp-content/uploads/2023/02/iconmonstr-user-33-240.png": null,
};

function resolveImg(p) {
  if (FALLBACK_IMG[p.img] !== undefined) return FALLBACK_IMG[p.img];
  return p.img;
}

function isPlaceholder(p, resolvedImg) {
  if (
    !p.name ||
    p.name === "–" ||
    p.name === "&#8211;" ||
    p.name === "-" ||
    p.name === "—"
  )
    return true;
  if (!resolvedImg) return true;
  return false;
}

function getSlug(personName) {
  const matched = peopleProd.find((pp) => pp.name.trim() === personName.trim());
  if (matched && matched.slug && matched.slug !== "ke") {
    return matched.slug;
  }
  return null;
}

function getModalId(slug) {
  if (!slug) return null;
  const info = slugMapping[slug];
  return info ? info.id : null;
}

function cardHtml(p) {
  const resolvedImg = resolveImg(p);
  const isPlace = isPlaceholder(p, resolvedImg);
  const slug = getSlug(p.name);
  const modalId = getModalId(slug);

  if (isPlace) {
    return `
<div class="vp-oc-card vp-oc-empty">
  <div class="vp-oc-avatar" style="background:linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%); color:#6b7280;">?</div>
  <h3 class="vp-oc-name" style="color:#94a3b8;">(รอการแต่งตั้ง)</h3>
  <p class="vp-oc-pos">${p.position}</p>
  <button class="vp-oc-btn" disabled>รายละเอียด</button>
</div>`;
  }

  const btn = modalId
    ? `<button class="vp-oc-btn vp-oc-btn-active" data-modal-id="${modalId}">รายละเอียด</button>`
    : `<button class="vp-oc-btn" disabled>รายละเอียด</button>`;

  return `
<div class="vp-oc-card">
  <div class="vp-oc-avatar-wrap">
    <img loading="lazy" decoding="async" src="${resolvedImg}" alt="${p.name}" class="vp-oc-avatar" />
  </div>
  <h3 class="vp-oc-name">${p.name}</h3>
  <p class="vp-oc-pos">${p.position}</p>
  ${p.email && p.email !== "-" && p.email !== "–" ? `<p class="vp-oc-email"><a href="mailto:${p.email}">${p.email}</a></p>` : ""}
  ${btn}
</div>`;
}

// Org chart hierarchy 4 ระดับ (1 → 3 → 6 → 2)
// Based on production data, structured as:
//
// LEVEL 1 (1) : ประธานกรรมการ สทร.
//   LEVEL 2 (3) : ที่ปรึกษา + กรรมการผู้ทรงคุณวุฒิ (2 คน)
//     LEVEL 3 (6) : กรรมการโดยตำแหน่ง + เลขานุการ + ที่ปรึกษาคณะกรรมการ
//       LEVEL 4 (2 sections) : ผู้บริหาร (4 คนจริง + 4 ตำแหน่งว่าง) | ที่ปรึกษา (5 คน)

const findByName = (name) =>
  peopleProd.find((p) => p.name === name) || {
    name,
    position: "",
    slug: "",
    email: null,
    img: null,
  };

// LEVEL 1
const l1 = [findByName("รศ.ดร. โชติชัย เจริญงาม")];

// LEVEL 2 — ที่ปรึกษา + กรรมการผู้ทรงคุณวุฒิ (3 คน)
const l2 = [
  findByName("ถาวร ชลัษเฐียร"),
  findByName("ผศ. พิศิษฐ์ แสง-ชูโต"),
  findByName("ดรุณ แสงฉาย"),
];

// LEVEL 3 — กรรมการโดยตำแหน่ง + เลขานุการ + ที่ปรึกษาคณะกรรมการ (6 คน)
const l3 = [
  findByName("ดร. พิเชฐ คุณาธรรมรักษ์"),
  findByName("พัฒนพงษ์ พงศ์ศุภสมิทธิ์"),
  findByName("ผู้แทน ผู้ว่าการรถไฟแห่งประเทศไทย"),
  findByName("ผู้แทน กระทรวงการอุดมศึกษา วิทยาศาสตร์ วิจัยและนวัตกรรม"),
  findByName("ดร. เพียงออ เลาหะวิไลย"),
  findByName("ดร. จุลเทพ ขจรไชยกูล"),
];

// LEVEL 4A — ผู้บริหาร (รวมรองผอ. 2 + ผจ.ก. 3 = 5 คนจริง + ตำแหน่งว่าง)
const l4a = [
  // ผู้อำนวยการ
  findByName("ดร. เพียงออ เลาหะวิไลย"),
  // รองผู้อำนวยการ (2 ตำแหน่งว่าง)
  { name: "", position: "รองผู้อำนวยการ", slug: "", email: null, img: null },
  { name: "", position: "รองผู้อำนวยการ", slug: "", email: null, img: null },
  // ผู้จัดการกลุ่ม 3 คน
  findByName("ดร.กิติพันธุ์ นุตยกุล"),
  findByName("ชัยวุฒิ ตันไชย"),
  findByName("ชัชวาล พานวงษ์"),
  // 2 ตำแหน่งว่าง
  {
    name: "",
    position: "ผู้จัดการกลุ่มกลยุทธ์และสื่อสารองค์กร",
    slug: "",
    email: null,
    img: null,
  },
  { name: "", position: "ผู้จัดการกลุ่มบริหารภายใน", slug: "", email: null, img: null },
];

// LEVEL 4B — ที่ปรึกษา (5 คน)
const l4b = [
  findByName("ดร. เสถียร เจริญเหรียญ"),
  findByName("เยาวลักษณ์ จำปีรัตน์"),
  findByName("ชุณหจิต สังข์ใหม่"),
  findByName("วัชรชาญ สิริสุวรรณทัศน์"),
  findByName("รศ.ดร. นวลน้อย ตรีรัตน์"),
];

// Build level rows
const levelRow = (levelNum, label, persons, columns) => `
<div class="vp-oc-level">
  <div class="vp-oc-level-label">${label}</div>
  <div class="vp-oc-row" style="grid-template-columns:repeat(${columns}, 1fr);">
    ${persons.map((p) => cardHtml(p)).join("")}
  </div>
</div>`;

const orgChart = `
<div class="vp-oc">
  <h2 class="vp-oc-title">โครงสร้างคณะกรรมการและผู้บริหาร</h2>
  <p class="vp-oc-subtitle">สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน)</p>
  
  ${levelRow(1, "ระดับ 1 — ประธานกรรมการ", l1, 1)}
  ${levelRow(2, "ระดับ 2 — ที่ปรึกษาและกรรมการ", l2, 3)}
  ${levelRow(3, "ระดับ 3 — กรรมการโดยตำแหน่ง", l3, 3)}
  ${levelRow(4, "ระดับ 4A — ผู้บริหาร", l4a, 4)}
  ${levelRow(4, "ระดับ 4B — ที่ปรึกษา", l4b, 5)}
</div>
`;

// Modal overlay
const modalHtml = `
<div id="vp-board-modal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; z-index:10000; background:rgba(0,0,0,0.5); align-items:center; justify-content:center; padding:20px;">
  <div role="dialog" aria-modal="true" style="background:#ffffff; border-radius:12px; max-width:720px; width:100%; max-height:85vh; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,0.4);">
    <div style="padding:18px 24px; border-bottom:1px solid #e5e7eb; display:flex; align-items:center; justify-content:space-between; background:#003471; color:#ffffff; position:relative; z-index:1;">
      <h2 id="vp-board-modal-title" style="margin:0; font-size:1.2rem; font-weight:600; line-height:1.3; flex:1; padding-right:16px;"></h2>
      <button id="vp-board-modal-close" aria-label="ปิด" style="background:transparent; border:none; color:#ffffff; font-size:1.5rem; cursor:pointer; line-height:1; padding:0; width:32px; height:32px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">×</button>
    </div>
    <div id="vp-board-modal-content" style="padding:24px; overflow-y:auto; line-height:1.6; color:#374151;"></div>
  </div>
</div>
`;

// CSS — org chart layout
const css = `
.vp-oc {
  font-family: inherit;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 0;
}
.vp-oc-title {
  text-align: center;
  font-size: 1.5rem;
  font-weight: 700;
  color: #003471;
  margin: 0 0 8px;
}
.vp-oc-subtitle {
  text-align: center;
  font-size: 0.95rem;
  color: #6b7280;
  margin: 0 0 32px;
}
.vp-oc-level {
  margin-bottom: 24px;
}
.vp-oc-level-label {
  text-align: center;
  font-size: 0.85rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 16px;
  padding: 6px 16px;
  background: #f3f4f6;
  border-radius: 999px;
  display: inline-block;
  /* Center horizontally */
  position: relative;
  left: 50%;
  transform: translateX(-50%);
}
.vp-oc-row {
  display: grid;
  gap: 16px;
  align-items: start;
  justify-items: center;
}
.vp-oc-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px 12px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 52, 113, 0.06);
  transition: box-shadow 200ms ease, transform 200ms ease;
  width: 100%;
  max-width: 200px;
}
.vp-oc-card:hover {
  box-shadow: 0 8px 24px rgba(0, 52, 113, 0.15);
  transform: translateY(-2px);
}
.vp-oc-empty {
  background: linear-gradient(135deg, #f8fafc 0%, #eef4fb 100%);
  border: 2px dashed #cbd5e1;
  box-shadow: none;
}
.vp-oc-empty:hover {
  transform: none;
  box-shadow: none;
}
.vp-oc-avatar-wrap {
  width: 100px;
  height: 100px;
  margin: 0 auto 12px;
  border-radius: 50%;
  overflow: hidden;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid #ffffff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.vp-oc-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.vp-oc-empty .vp-oc-avatar-wrap {
  border: 2px dashed #cbd5e1;
  box-shadow: none;
}
.vp-oc-empty .vp-oc-avatar {
  font-size: 2rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.vp-oc-name {
  margin: 0 0 6px;
  font-size: 0.95rem;
  color: #003471;
  font-weight: 600;
  line-height: 1.3;
  min-height: 2.5em;
}
.vp-oc-pos {
  margin: 0 0 8px;
  font-size: 0.8rem;
  color: #374151;
  line-height: 1.4;
  min-height: 2.5em;
}
.vp-oc-email {
  margin: 0 0 8px;
  font-size: 0.75rem;
}
.vp-oc-email a {
  color: #0066b3;
  text-decoration: none;
}
.vp-oc-email a:hover {
  text-decoration: underline;
}
.vp-oc-btn {
  display: inline-block;
  padding: 6px 16px;
  background: #cbd5e1;
  color: #64748b;
  border: none;
  border-radius: 6px;
  font-size: 0.78rem;
  cursor: not-allowed;
  font-family: inherit;
}
.vp-oc-btn-active {
  background: #003471;
  color: #ffffff;
  cursor: pointer;
  transition: background 150ms ease;
}
.vp-oc-btn-active:hover {
  background: #0066b3;
}

@media (max-width: 900px) {
  .vp-oc-row { gap: 12px !important; }
  .vp-oc-card { max-width: 180px; padding: 12px 8px; }
  .vp-oc-avatar-wrap { width: 80px; height: 80px; }
  .vp-oc-name { font-size: 0.85rem; }
  .vp-oc-pos { font-size: 0.75rem; }
}
@media (max-width: 600px) {
  .vp-oc-row { grid-template-columns: 1fr 1fr !important; }
  .vp-oc-card { max-width: 100%; }
}
`;

const modalsData = JSON.stringify(allModalsById);
const slugMappingData = JSON.stringify(
  Object.fromEntries(Object.entries(slugMapping).map(([k, v]) => [v.id, v])),
);

const thHtml = `
<style>${css}</style>

${orgChart}

${modalHtml}

<script>
(function() {
  var MODALS = ${modalsData};
  var SLUG_MAP = ${slugMappingData};
  var modal = document.getElementById('vp-board-modal');
  var titleEl = document.getElementById('vp-board-modal-title');
  var contentEl = document.getElementById('vp-board-modal-content');
  var closeBtn = document.getElementById('vp-board-modal-close');
  
  function openModal(id) {
    var html = MODALS[String(id)];
    if (!html) return;
    var triggerBtn = document.querySelector('.vp-oc-btn-active[data-modal-id="' + id + '"]');
    var card = triggerBtn ? triggerBtn.closest('.vp-oc-card') : null;
    var name = '';
    if (card) {
      var h3 = card.querySelector('.vp-oc-name');
      if (h3) name = h3.textContent.trim();
    }
    if (!name && SLUG_MAP[String(id)]) {
      name = SLUG_MAP[String(id)].title || '';
    }
    titleEl.textContent = name || 'รายละเอียด';
    contentEl.innerHTML = html;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  
  function closeModal() {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
  
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.vp-oc-btn-active');
    if (btn) {
      e.preventDefault();
      openModal(btn.getAttribute('data-modal-id'));
    }
  });
  
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal.style.display === 'flex') closeModal();
  });
})();
</script>
`;

await p.contentRecord.update({
  where: { path: "/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร" },
  data: { contentHtml: thHtml, modified: new Date().toISOString() },
});

console.log("UPDATED TH v3 — Org chart layout");
console.log("HTML LEN:", thHtml.length);
console.log(
  "L1:",
  l1.length,
  "L2:",
  l2.length,
  "L3:",
  l3.length,
  "L4A:",
  l4a.length,
  "L4B:",
  l4b.length,
);

await p.$disconnect();
