import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { readFile, writeFile } from "node:fs/promises";

const PAGES = [
  { id: "th-page-414", lang: "th" },
  { id: "en-page-414", lang: "en" },
];

// 4 events. Each = numbered card with text body + uniform 2-col image gallery.
// Per user instruction: keep ALL images, uniform 2-col grid via object-fit:cover.
const TH = [
  {
    n: "1",
    text:
      "การลงพื้นที่จังหวัดอุดรธานี จังหวัดหนองคาย และ สาธารณรัฐประชาธิปไตยประชาชนลาว (สปป.ลาว) ในระหว่างวันที่ 26-27 ม.ค. 66 ร่วมกับกรมการขนส่งทางราง (ขร.) เพื่อสำรวจแนวเส้นทางการขนส่งสินค้าแบบควบคุมอุณหภูมิในระบบราง (Cold Chain Logistics) และรับรู้ถึงปัญหา และข้อจำกัดของการขนส่งสินค้าทางรางแบบควบคุมอุณหภูมิจากประเทศไทยไปยังจีน โดยผ่านเส้นทางรถไฟความเร็วสูงลาว-จีน",
    imgs: [
      "ข่าวที่1-2.png",
      "ข่าวที่1-3.png",
      "ข่าวที่1-1-709x1024.png",
      "ข่าวที่1-6.png",
      "ข่าวที่1-4.png",
      "ข่าวที่1-5.png",
    ],
  },
  {
    n: "2",
    text:
      "เข้าร่วมโครงการทดลองการใช้งาน Fuel cell สำหรับรถไฟ รฟท. ณ สถาบันนวัตกรรม ปตท. อ.วังน้อย จ.พระนครศรีอยุธยา ในวันที่ 17 กุมภาพัฒน์ 2566 นำโดย นายวัชรชาญ สิริสุวรรณทัศน์ รองผู้ว่าการรถไฟแห่งประเทศไทย และ ดร.สันติ เจริญพรพัฒนา ผอ. สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) นำคณะนักวิจัย สทร. โดยมี คุณยุทธนา สุวรรณโชติ ผู้ช่วยกรรมการผู้จัดการใหญ่ สถาบันนวัตกรรม ปตท. และทีมงานร่วมให้การต้อนรับ พร้อมนำเสนอข้อมูลการใช้พลังงานไฮโดรเจน ทั้งในและต่างประเทศ และเข้าเยี่ยมชมอาคารทดสอบต่างๆ",
    imgs: [
      "ข่าวที่2-1-1024x682.jpg",
      "ข่าวที่2-2.jpg",
      "ข่าวที่2-3-1024x651.jpg",
      "ข่าวที่2-4-1024x682.jpg",
    ],
  },
  {
    n: "3",
    text:
      "การสัมมนา Hydrogen Thailand symposium ณ Holiday Inn Pattaya ในวันที่ วันที่ 23 กุมภาพัฒน์ 2566 ซึ่งเป็นงานที่เกิดจากความร่วมมือกันของหน่วยงานทั้งภาครัฐและเอกชน เพื่อผลักดันและเตรียมความพร้อมในการใช้พลังงานจากไฮโดรเจนและเซลล์เชื้อเพลิง ภายในงานจัดแสดงนิทรรศการ และให้สัมมนาหัวข้อที่มีความน่าสนใจเกี่ยวกับพลังงานไฮโดรเจน ทั้งในส่วนของการ ผลิต กักเก็บ การใช้ประโยชน์ และนโยบายที่ส่งเสริมให้เกิดการใช้งานอย่างเหมาะสมในต่างประเทศ",
    imgs: [
      "ข่าวที่3-1-1024x576.jpg",
      "ข่าวที่3-2-1024x576.jpg",
      "ข่าวที่3-3-1024x576.jpg",
      "ข่าวที่3-4-1024x576.jpg",
    ],
  },
  {
    n: "4",
    text:
      "การลงพื้นที่สำรวจแนวเส้นทางการขนส่งสินค้าแบบควบคุมอุณหภูมิในระบบราง (Cold Chain Logistics) ณ จังหวัดระยอง และจังหวัดจันทบุรี ในวันที่ 1-2 มีนาคม 2566 โดยทางทีมวิจัยฯร่วมกับกรมการขนส่งทางราง (ขร.) ได้ทำการสัมภาษณ์คุณปัญญา ปะพุธสะโร ประธานกรรมการ บริษัท เก้าเจริญ เทรน ทรานสปอร์ต จำกัด ณ สถานีรถไฟมาบตาพุด ถึงสถานการณ์ปัจจุบัน ปัญหา ข้อจำกัด และแผนในอนาคตของการขนส่งทุเรียนโดยระบบรางจากไทยไปจีน และได้เยี่ยมชมขั้นตอนการบรรจุทุเรียนในตู้ขนส่งสินค้าแบบควบคุมอุณหภูมิ",
    imgs: [
      "ข่าวที่4-1-1024x683.jpg",
      "ข่าวที่4-2-1024x576.jpg",
      "ข่าวที่4-3-1024x683.jpg",
      "ข่าวที่4-4-1024x576.jpg",
      "ข่าวที่4-5-1024x576.jpg",
      "ข่าวที่4-6-1024x683.jpg",
      "ข่าวที่4-7-1024x683.jpg",
    ],
  },
];

const EN = [
  {
    n: "1",
    text:
      "On January 26-27, 2023, The R&amp;D Team, together with the Department of Rail Transport, conducted field visits in Udon Thani Province, Nong Khai Province, and the Lao People's Democratic Republic (Lao PDR). The purpose of the visits was to explore the route for temperature-controlled freight in the rail system, also known as cold chain logistics, and to identify any problems or limitations in temperature-controlled rail transport from Thailand to China via the Laos-China high-speed rail route.",
    imgs: [
      "ข่าวที่1-2.png",
      "ข่าวที่1-3.png",
      "ข่าวที่1-1-709x1024.png",
      "ข่าวที่1-6.png",
      "ข่าวที่1-4.png",
      "ข่าวที่1-5.png",
    ],
  },
  {
    n: "2",
    text:
      "On February 17, 2023, the R&amp;D team participated in a discussion on the fuel cell trial project for SRT trains at PTT Innovation Institute in Wang Noi District, Phra Nakhon Si Ayutthaya Province. The meeting was led by Mr. Watcharachan Sirisuwantas, Deputy Governor of the State Railway of Thailand, and Dr. Santi Charoenpornpattana, Director of Rail Technology Research and Development Agency (Public Organization), who were accompanied by a team of researchers. Mr. Yuttana Suwanchot, Executive Vice President of PTT Innovation Institute, and his team members welcomed us and provided information on hydrogen energy use both domestically and internationally. We also viewed various laboratories as part of the project.",
    imgs: [
      "ข่าวที่2-1-1024x682.jpg",
      "ข่าวที่2-2.jpg",
      "ข่าวที่2-3-1024x651.jpg",
      "ข่าวที่2-4-1024x682.jpg",
    ],
  },
  {
    n: "3",
    text:
      "On February 23, 2023, the R&amp;D team participated in the Hydrogen Thailand symposium at Holiday Inn Pattaya. The event was a collaboration between the government and private sectors aimed at promoting the use of hydrogen and fuel cells as a source of energy. The symposium featured an exhibition as well as seminars on various topics related to hydrogen energy, including production, storage, utilization, and policies that promote the fair use of hydrogen in Thailand.",
    imgs: [
      "ข่าวที่3-1-1024x576.jpg",
      "ข่าวที่3-2-1024x576.jpg",
      "ข่าวที่3-3-1024x576.jpg",
      "ข่าวที่3-4-1024x576.jpg",
    ],
  },
  {
    n: "4",
    text:
      "On March 1-2, 2023, the R&amp;D team, together with the Department of Rail Transport (DRT), conducted field surveys of temperature-controlled freight transport routes in the rail system (Cold Chain Logistics) in Rayong and Chanthaburi provinces. The team interviewed Mr. Panya Paputsaro, Chairman of Kao Charoen Train Transport Co., Ltd., at Map Ta Phut railway station, regarding the current situation, problems, limitations, and future plans for durian transport by rail from Thailand to China. The team also observed the process of loading durian into temperature-controlled cargo containers.",
    imgs: [
      "ข่าวที่4-1-1024x683.jpg",
      "ข่าวที่4-2-1024x576.jpg",
      "ข่าวที่4-3-1024x683.jpg",
      "ข่าวที่4-4-1024x576.jpg",
      "ข่าวที่4-5-1024x576.jpg",
      "ข่าวที่4-6-1024x683.jpg",
      "ข่าวที่4-7-1024x683.jpg",
    ],
  },
];

function buildSection(events, lang) {
  const titleLabel = lang === "en" ? "News" : "ข่าวที่";
  return events
    .map(
      (e) => `
<div class="deliv-block">
  <div class="deliv-block-header">
    <span class="deliv-block-num">${e.n}</span>
    <h4 class="deliv-block-title">${titleLabel} ${e.n}</h4>
  </div>
  <p class="deliv-block-text">${e.text}</p>
  <div class="deliv-block-grid">
    ${e.imgs
      .map(
        (img) => `
    <figure class="deliv-block-cell">
      <img src="/wp-content/uploads/2023/04/${img}" alt="" loading="lazy" decoding="async">
    </figure>`,
      )
      .join("")}
  </div>
</div>`,
    )
    .join("\n");
}

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

for (const { id, lang } of PAGES) {
  const r = await p.contentRecord.findUnique({
    where: { id },
    select: { id: true, path: true, contentHtml: true, language: true },
  });
  if (!r) {
    console.error("not found:", id);
    continue;
  }
  const h = r.contentHtml;
  // Find the heading <h3 ...>...ผลงานปัจจุบัน...</h3> (or Project Deliverables)
  const target = lang === "en" ? "Project Deliverables" : "ผลงานปัจจุบัน";
  // Match the actual h3 start
  const headingRe = /<h3 class="wp-block-heading"[^>]*>[\s\S]*?<\/h3>/g;
  let headingStart = -1,
    headingEnd = -1;
  let m;
  while ((m = headingRe.exec(h)) !== null) {
    const inner = m[0].replace(/<[^>]+>/g, "");
    if (inner.includes(target)) {
      headingStart = m.index;
      headingEnd = m.index + m[0].length;
      break;
    }
  }
  if (headingStart < 0) {
    console.error("heading not found for", id);
    continue;
  }

  // Stash backup to SiteMeta (jsonb) BEFORE any edit
  const backupKey = "deliv_414_v1_" + lang + "_backup";
  await p.siteMeta.upsert({
    where: { key: backupKey },
    create: { key: backupKey, value: JSON.stringify(h) },
    update: { value: JSON.stringify(h) },
  });
  console.log("[", id, "] backup stashed:", backupKey, "html len:", h.length);

  const events = lang === "en" ? EN : TH;
  const newSection = buildSection(events, lang);
  const newHtml =
    h.slice(0, headingEnd) + "\n\n" + newSection + "\n";

  await p.contentRecord.update({
    where: { id },
    data: { contentHtml: newHtml, modified: new Date().toISOString() },
  });
  console.log("[", id, "] updated. new html len:", newHtml.length);

  // Mirror to wp-content.json
  const j = JSON.parse(await readFile("src/data/wp-content.json", "utf8"));
  const idx = j.records.findIndex(
    (x) => x.path === r.path && x.language === lang,
  );
  if (idx >= 0) {
    j.records[idx] = { ...j.records[idx], contentHtml: newHtml };
    await writeFile(
      "src/data/wp-content.json",
      JSON.stringify(j, null, 2) + "\n",
    );
    console.log("[", id, "] mirrored to wp-content.json");
  } else {
    console.error("[", id, "] record not found in JSON, manual mirror needed");
  }
}

await p.$disconnect();
console.log("\nDONE.");
