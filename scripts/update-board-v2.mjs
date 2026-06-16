// ปรับหน้า "คณะกรรมการและผู้บริหาร" v2
// - เอา "ระดับ X" และ "จำนวนท่าน" ออก
// - เพิ่มปุ่ม "รายละเอียด" ในแต่ละ card → เปิด modal แสดงข้อมูลจาก production
// - 4 accordion เรียงบนลงล่าง + grid 3 คอลัมน์

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { readFileSync } from "fs";

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Load prod data
const slugMapping = JSON.parse(readFileSync("/tmp/slug-to-modal.json", "utf-8"));
const modals = JSON.parse(readFileSync("/tmp/people-modals.json", "utf-8"));
const peopleProd = JSON.parse(readFileSync("/tmp/people-prod.json", "utf-8"));

// Save modal contents to SiteMeta for safe access (Next.js can read)
const allModalsById = {};
for (const [pid, data] of Object.entries(modals)) {
  allModalsById[pid] = data.content_html;
}
await p.siteMeta.upsert({
  where: { key: "board_modals_v1" },
  update: { value: allModalsById },
  create: { key: "board_modals_v1", value: allModalsById },
});
await p.siteMeta.upsert({
  where: { key: "board_slug_mapping_v1" },
  update: { value: slugMapping },
  create: { key: "board_slug_mapping_v1", value: slugMapping },
});
console.log("SAVED modals to SiteMeta: board_modals_v1, board_slug_mapping_v1");

// Backup
const oldTh = await p.contentRecord.findUnique({
  where: { path: "/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร" },
});
await p.siteMeta.upsert({
  where: { key: "board_backup_v2_th" },
  update: { value: oldTh.contentHtml },
  create: { key: "board_backup_v2_th", value: oldTh.contentHtml },
});

// Load parsed data (current sections)
const data = JSON.parse(readFileSync("/tmp/board-data.json", "utf-8"));

// FALLBACK_IMG same as v1
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
  if (!p.name || p.name === "–" || p.name === "-" || p.name === "—") return true;
  if (!resolvedImg) return true;
  return false;
}

// Match name from DB to slug from production
function getSlug(personName, personEmail) {
  // Find matching person in production data
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

function cardHtml(p, idx, sectionIdx) {
  const resolvedImg = resolveImg(p);
  const isPlace = isPlaceholder(p, resolvedImg);
  const slug = getSlug(p.name, p.email);
  const modalId = getModalId(slug);

  if (isPlace) {
    return `
<div class="vp-board-card vp-board-empty" style="background:linear-gradient(135deg, #f8fafc 0%, #eef4fb 100%); border:2px dashed #cbd5e1; border-radius:12px; padding:24px 16px; text-align:center;">
  <div style="width:120px; height:160px; margin:0 auto 16px; border-radius:8px; background:linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%); display:flex; align-items:center; justify-content:center; color:#6b7280; font-size:0.9rem; font-weight:500;">ไม่มีรูปภาพ</div>
  <h3 style="margin:0 0 8px; font-size:1rem; color:#94a3b8; font-weight:500;">(รอการแต่งตั้ง)</h3>
  <p style="margin:0 0 12px; font-size:0.9rem; color:#64748b; line-height:1.5;">${p.position}</p>
  <button disabled style="display:inline-block; padding:6px 20px; background:#cbd5e1; color:#64748b; border:none; border-radius:6px; font-size:0.85rem; cursor:not-allowed;">รายละเอียด</button>
</div>`;
  }

  // If has modal, use button to open it; else use disabled
  const btn = modalId
    ? `<button class="vp-board-detail-btn" data-modal-id="${modalId}" style="display:inline-block; padding:8px 24px; background:#003471; color:#ffffff; border:none; border-radius:6px; font-size:0.9rem; font-weight:500; cursor:pointer; transition:background 150ms ease;">รายละเอียด</button>`
    : `<button disabled style="display:inline-block; padding:8px 24px; background:#cbd5e1; color:#64748b; border:none; border-radius:6px; font-size:0.9rem; cursor:not-allowed;">รายละเอียด</button>`;

  return `
<div class="vp-board-card" style="background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; padding:20px 16px; text-align:center; box-shadow:0 2px 8px rgba(0, 52, 113, 0.06); transition:box-shadow 200ms ease;">
  <img loading="lazy" decoding="async" src="${resolvedImg}" alt="${p.name}" style="display:block; width:160px; height:200px; object-fit:cover; margin:0 auto 16px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.08);" />
  <h3 style="margin:0 0 8px; font-size:1.05rem; color:#003471; font-weight:600; line-height:1.3;">${p.name}</h3>
  <p style="margin:0 0 8px; font-size:0.9rem; color:#374151; line-height:1.4;">${p.position}</p>
  ${p.email && p.email !== "-" ? `<p style="margin:0 0 12px;"><a href="mailto:${p.email}" style="font-size:0.85rem; color:#0066b3; text-decoration:none;">${p.email}</a></p>` : '<div style="height:12px;"></div>'}
  ${btn}
</div>`;
}

function sectionHtml(sec, idx) {
  const isOpen = idx === 0;
  const openAttr = isOpen ? " open" : "";
  return `
<details class="vp-board-accordion"${openAttr} style="margin:0 0 20px; background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0, 52, 113, 0.04);">
  <summary style="padding:20px 24px; cursor:pointer; display:flex; align-items:center; gap:16px; list-style:none; background:${isOpen ? "linear-gradient(135deg, #003471 0%, #0066b3 100%)" : "#f8fafc"}; color:${isOpen ? "#ffffff" : "#003471"}; font-weight:600;">
    <span style="flex:1; font-size:1.15rem;">${sec.title}</span>
    <span class="vp-board-chevron" style="display:inline-block; transition:transform 200ms ease; font-size:1.2rem;">▾</span>
  </summary>
  <div style="padding:32px 24px;">
    <div class="vp-board-grid" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:20px; align-items:start;">
      ${sec.persons.map((p, i) => cardHtml(p, i, idx)).join("")}
    </div>
  </div>
</details>`;
}

// Modal overlay (hidden by default) - empty, populated by JS
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

// CSS
const css = `
.vp-board-accordion summary::-webkit-details-marker { display: none; }
.vp-board-accordion[open] .vp-board-chevron { transform: rotate(180deg); }
.vp-board-card:hover { box-shadow: 0 8px 24px rgba(0, 52, 113, 0.12) !important; }
.vp-board-detail-btn:hover { background: #0066b3 !important; }
@media (max-width: 900px) { .vp-board-grid { grid-template-columns: repeat(2, 1fr) !important; } }
@media (max-width: 600px) { .vp-board-grid { grid-template-columns: 1fr !important; } }
`;

// Inline modal data (encoded JSON)
const modalsData = JSON.stringify(allModalsById);
const slugMappingData = JSON.stringify(
  Object.fromEntries(Object.entries(slugMapping).map(([k, v]) => [v.id, v])),
);

const thHtml = `
<style>${css}</style>

${data.map((s, i) => sectionHtml(s, i)).join("\n")}

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
    // Get name from triggering card's h3, fall back to slug mapping title
    var triggerBtn = document.querySelector('.vp-board-detail-btn[data-modal-id="' + id + '"]');
    var card = triggerBtn ? triggerBtn.closest('.vp-board-card') : null;
    var name = '';
    if (card) {
      var h3 = card.querySelector('h3');
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
    var btn = e.target.closest('.vp-board-detail-btn');
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

console.log("UPDATED TH v2");
console.log("HTML LEN:", thHtml.length);

await p.$disconnect();
