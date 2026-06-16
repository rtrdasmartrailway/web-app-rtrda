// ปรับหน้า "คณะกรรมการและผู้บริหาร"
// - 4 accordion เรียงบนลงล่าง (ระดับ 1 → 4)
// - CSS Grid 3 คอลัมน์ สม่ำเสมอ
// - Card สวย: ภาพกรอบมน + ชื่อ + ตำแหน่ง + email
// - Placeholder "–" → "(รอการแต่งตั้ง)" + ซ่อน placeholder image
// - Accordion แรกเปิด default

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { readFileSync } from "fs";

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Backup
const oldTh = await p.contentRecord.findUnique({
  where: { path: "/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร" },
});
const oldEn = await p.contentRecord.findUnique({
  where: { path: "/en/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร" },
});
await p.siteMeta.upsert({
  where: { key: "board_backup_v1_th" },
  update: { value: oldTh.contentHtml },
  create: { key: "board_backup_v1_th", value: oldTh.contentHtml },
});
await p.siteMeta.upsert({
  where: { key: "board_backup_v1_en" },
  update: { value: oldEn.contentHtml },
  create: { key: "board_backup_v1_en", value: oldEn.contentHtml },
});

// Load parsed data
const data = JSON.parse(readFileSync("/tmp/board-data.json", "utf-8"));

// Map broken assets to working fallbacks (or null for placeholder)
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

// resolve image path with fallback
function resolveImg(p) {
  if (FALLBACK_IMG[p.img] !== undefined) {
    return FALLBACK_IMG[p.img]; // null means use placeholder
  }
  return p.img;
}

// Detect placeholders (empty name, name=–, broken asset)
function isPlaceholder(p, resolvedImg) {
  if (!p.name || p.name === "–" || p.name === "-" || p.name === "—") return true;
  if (!resolvedImg) return true;
  return false;
}

function cardHtml(p, idx) {
  const resolvedImg = resolveImg(p);
  const isPlace = isPlaceholder(p, resolvedImg);
  if (isPlace) {
    return `
<div class="vp-board-card vp-board-empty" style="background:linear-gradient(135deg, #f8fafc 0%, #eef4fb 100%); border:2px dashed #cbd5e1; border-radius:12px; padding:24px 16px; text-align:center;">
  <div style="width:120px; height:160px; margin:0 auto 16px; border-radius:8px; background:linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%); display:flex; align-items:center; justify-content:center; color:#6b7280; font-size:0.9rem; font-weight:500;">ไม่มีรูปภาพ</div>
  <h3 style="margin:0 0 8px; font-size:1rem; color:#94a3b8; font-weight:500;">(รอการแต่งตั้ง)</h3>
  <p style="margin:0; font-size:0.9rem; color:#64748b; line-height:1.5;">${p.position}</p>
</div>`;
  }
  return `
<div class="vp-board-card" style="background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; padding:20px 16px; text-align:center; box-shadow:0 2px 8px rgba(0, 52, 113, 0.06); transition:box-shadow 200ms ease;">
  <img loading="lazy" decoding="async" src="${resolvedImg}" alt="${p.name}" style="display:block; width:160px; height:200px; object-fit:cover; margin:0 auto 16px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.08);" />
  <h3 style="margin:0 0 8px; font-size:1.05rem; color:#003471; font-weight:600; line-height:1.3;">${p.name}</h3>
  <p style="margin:0 0 8px; font-size:0.9rem; color:#374151; line-height:1.4;">${p.position}</p>
  ${p.email && p.email !== "-" ? `<p style="margin:0;"><a href="mailto:${p.email}" style="font-size:0.85rem; color:#0066b3; text-decoration:none;">${p.email}</a></p>` : ""}
</div>`;
}

function sectionHtml(sec, idx, totalSections) {
  const level = idx + 1;
  const isOpen = idx === 0; // open first by default
  const personCount = sec.persons.length;
  const openAttr = isOpen ? " open" : "";
  return `
<details class="vp-board-accordion"${openAttr} style="margin:0 0 20px; background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0, 52, 113, 0.04);">
  <summary style="padding:20px 24px; cursor:pointer; display:flex; align-items:center; gap:16px; list-style:none; background:${isOpen ? "linear-gradient(135deg, #003471 0%, #0066b3 100%)" : "#f8fafc"}; color:${isOpen ? "#ffffff" : "#003471"}; font-weight:600;">
    <span style="display:inline-flex; align-items:center; justify-content:center; min-width:36px; height:36px; padding:0 12px; background:${isOpen ? "rgba(255,255,255,0.2)" : "#003471"}; color:${isOpen ? "#ffffff" : "#ffffff"}; border-radius:8px; font-size:0.9rem; font-weight:700;">ระดับ ${level}</span>
    <span style="flex:1; font-size:1.15rem;">${sec.title}</span>
    <span style="font-size:0.9rem; opacity:0.85;">${personCount} ท่าน</span>
    <span class="vp-board-chevron" style="display:inline-block; transition:transform 200ms ease; font-size:1.2rem;">▾</span>
  </summary>
  <div style="padding:32px 24px;">
    <div class="vp-board-grid" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:20px; align-items:start;">
      ${sec.persons.map((p, i) => cardHtml(p, i)).join("")}
    </div>
  </div>
</details>`;
}

const thHtml = `
<style>
.vp-board-accordion summary::-webkit-details-marker { display: none; }
.vp-board-accordion[open] .vp-board-chevron { transform: rotate(180deg); }
.vp-board-card:hover { box-shadow: 0 8px 24px rgba(0, 52, 113, 0.12) !important; }
@media (max-width: 900px) { .vp-board-grid { grid-template-columns: repeat(2, 1fr) !important; } }
@media (max-width: 600px) { .vp-board-grid { grid-template-columns: 1fr !important; } }
</style>

${data.map((s, i) => sectionHtml(s, i, data.length)).join("\n")}
`;

await p.contentRecord.update({
  where: { path: "/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร" },
  data: { contentHtml: thHtml, modified: new Date().toISOString() },
});

console.log("UPDATED TH (TH only for now)");
console.log("TH HTML LEN:", thHtml.length);
console.log(
  "Sections:",
  data.length,
  "Total cards:",
  data.reduce((s, x) => s + x.persons.length, 0),
);
console.log("Backup v1 saved: board_backup_v1_th/en");

await p.$disconnect();
