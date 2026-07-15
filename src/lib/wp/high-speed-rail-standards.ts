import { load } from "cheerio";
import type { PdfReaderTarget } from "./pdf-reader";
import { normalizeRoutePath } from "./url";

export interface HighSpeedRailStandardDocument {
  code?: string;
  year?: string;
  title: string;
  coverImage: string;
  previewHref: string;
  downloadHref: string;
}

const assetBase = "/standards/high-speed-rail";

export function isRailStandardsPath(path: string): boolean {
  const normalized = normalizeRoutePath(path).normalize("NFC");
  return normalized === "/มาตรฐานระบบราง-สทร" || normalized === "/en/มาตรฐานระบบราง-สทร";
}

export const importedHighSpeedRailStandardDocuments: HighSpeedRailStandardDocument[] = [
  {
    title:
      "ชุดมาตรฐานการทดสอบเพื่อควบคุมคุณภาพคอนกรีตสด(FRESH CONCRETE) สำหรับโครงการรถไฟความเร็วสูง",
    coverImage: "/wp-content/uploads/2025/05/2025-05-30-164836.jpg",
    previewHref: "/sdc_download/5545",
    downloadHref: "/sdc_download/5545",
  },
  {
    title: "ชุดมาตรฐานกำหนดคุณลักษณะคอนกรีตสำหรับโครงการรถไฟความเร็วสูง",
    coverImage: "/wp-content/uploads/2025/12/1.jpg",
    previewHref: "/3d-flip-book/สทร-hsr-ct-2001-20032568",
    downloadHref: "/sdc_download/7202",
  },
  {
    title: "มาตรฐานการทดสอบการขยายตัวอิสระของคอนกรีตขยายตัวสำหรับโครงการรถไฟความเร็วสูง",
    coverImage: "/wp-content/uploads/2025/12/2-1.jpg",
    previewHref: "/3d-flip-book/สทร-hsr-ct-40112568",
    downloadHref: "/sdc_download/7199",
  },
  {
    title:
      "มาตรฐานการทดสอบความเป็นไปได้ในการทำปฏิกิริยาระหว่างด่างกับมวลรวม (ทดสอบโดยตัวอย่างทดสอบมอร์ตาร์) สำหรับโครงการรถไฟความเร็วสูง",
    coverImage: "/wp-content/uploads/2025/12/3.jpg",
    previewHref: "/3d-flip-book/สทร-hsr-ct-4007-2568",
    downloadHref: "/sdc_download/7196",
  },
  {
    title:
      "มาตรฐานการทดสอบการขยายตัวเนื่องจากการทำปฏิกิริยาระหว่างด่างกับซิลิกา (ทดสอบโดยตัวอย่างทดสอบคอนกรีต) สำหรับโครงการรถไฟความเร็วสูง",
    coverImage: "/wp-content/uploads/2025/12/4.jpg",
    previewHref: "/3d-flip-book/สทร-hsr-ct-4008-2568",
    downloadHref: "/sdc_download/7193",
  },
  {
    title: "มาตรฐานการทดสอบการคืบตัวของคอนกรีตภายใต้แรงอัด สำหรับโครงการรถไฟความเร็วสูง",
    coverImage: "/wp-content/uploads/2025/12/5.jpg",
    previewHref: "/3d-flip-book/สทร-hsr-ct-4009-2568",
    downloadHref: "/sdc_download/7190",
  },
  {
    title:
      "มาตรฐานการทดสอบการเปลี่ยนแปลงน้ำหนักของมอร์ตาร์ที่สัมผัสสารละลายแมกนีเซียมซัลเฟตสำหรับโครงการรถไฟความเร็วสูง",
    coverImage: "/wp-content/uploads/2025/12/6.jpg",
    previewHref: "/3d-flip-book/สทร-hsr-ct-4010-2568",
    downloadHref: "/sdc_download/7187",
  },
];

export const additionalHighSpeedRailStandardDocuments: HighSpeedRailStandardDocument[] = [
  {
    code: "HSR-CT-1001",
    title: "มาตรฐานงานสำรวจ",
    coverImage: `${assetBase}/hsr-ct-1001-2568.png`,
    previewHref: `${assetBase}/hsr-ct-1001-2568.pdf`,
    downloadHref: `${assetBase}/hsr-ct-1001-2568.pdf`,
  },
  {
    code: "HSR-CT-1002",
    title: "มาตรฐานงานป้องกันน้ำ",
    coverImage: `${assetBase}/hsr-ct-1002-2568.png`,
    previewHref: `${assetBase}/hsr-ct-1002-2568.pdf`,
    downloadHref: `${assetBase}/hsr-ct-1002-2568.pdf`,
  },
  {
    code: "HSR-CT-3001",
    title: "มาตรฐานงานเจาะและระเบิด",
    coverImage: `${assetBase}/hsr-ct-3001-2568.png`,
    previewHref: `${assetBase}/hsr-ct-3001-2568.pdf`,
    downloadHref: `${assetBase}/hsr-ct-3001-2568.pdf`,
  },
  {
    code: "HSR-CT-3002",
    year: "2569",
    title: "มาตรฐานการก่อสร้างฐานราก สำหรับโครงสร้างทางยกระดับในโครงการรถไฟความเร็วสูง",
    coverImage: `${assetBase}/hsr-ct-3002-2569.png`,
    previewHref: `${assetBase}/hsr-ct-3002-2569.pdf`,
    downloadHref: `${assetBase}/hsr-ct-3002-2569.pdf`,
  },
  {
    code: "HSR-CT-3003",
    year: "2569",
    title:
      "มาตรฐานการก่อสร้างตอม่อและโครงพอทัลคอนกรีตเสริมเหล็ก สำหรับโครงสร้างทางยกระดับในโครงการรถไฟความเร็วสูง",
    coverImage: `${assetBase}/hsr-ct-3003-2569.png`,
    previewHref: `${assetBase}/hsr-ct-3003-2569.pdf`,
    downloadHref: `${assetBase}/hsr-ct-3003-2569.pdf`,
  },
  {
    code: "HSR-CT-3004",
    year: "2569",
    title:
      "มาตรฐานการก่อสร้างสาหรับงานติดตั้งเกอร์เดอร์รูปกล่องแบบชิ้นส่วนชนิดหล่อสำเร็จด้วยวิธีช่วงต่อช่วงโดยแกนทรีลาเลียง สำหรับโครงสร้างทางยกระดับในโครงการรถไฟความเร็วสูง",
    coverImage: `${assetBase}/hsr-ct-3004-2569.png`,
    previewHref: `${assetBase}/hsr-ct-3004-2569.pdf`,
    downloadHref: `${assetBase}/hsr-ct-3004-2569.pdf`,
  },
  {
    code: "HSR-CT-4012",
    title: "มาตรฐานงานตรวจวัด",
    coverImage: `${assetBase}/hsr-ct-4012-2568.png`,
    previewHref: `${assetBase}/hsr-ct-4012-2568.pdf`,
    downloadHref: `${assetBase}/hsr-ct-4012-2568.pdf`,
  },
  {
    code: "HSR-CT-4013",
    year: "2569",
    title:
      "มาตรฐานการตรวจสอบ การทดสอบ และการประเมินผลสมรรถนะของแกนทรีลาเลียงสาหรับงานติดตั้งเกอร์เดอร์รูปกล่องแบบชิ้นส่วนชนิดหล่อสาเร็จ สำหรับโครงสร้างทางยกระดับในโครงการรถไฟความเร็วสูง",
    coverImage: `${assetBase}/hsr-ct-4013-2569.png`,
    previewHref: `${assetBase}/hsr-ct-4013-2569.pdf`,
    downloadHref: `${assetBase}/hsr-ct-4013-2569.pdf`,
  },
  {
    code: "HSR-CT-5001",
    title: "มาตรฐานงานค้ำยัน",
    coverImage: `${assetBase}/hsr-ct-5001-2568.png`,
    previewHref: `${assetBase}/hsr-ct-5001-2568.pdf`,
    downloadHref: `${assetBase}/hsr-ct-5001-2568.pdf`,
  },
];

export const highSpeedRailStandardDocuments: HighSpeedRailStandardDocument[] = [
  ...additionalHighSpeedRailStandardDocuments.filter(
    (document) => document.year === "2569",
  ),
  ...additionalHighSpeedRailStandardDocuments.filter(
    (document) => document.year !== "2569",
  ),
  ...importedHighSpeedRailStandardDocuments,
];

export function stripImportedHighSpeedRailSection(html: string): string {
  const $ = load(html, null, false);
  $(".lightweight-accordion").each((_, element) => {
    const $accordion = $(element);
    const title = $accordion.find("summary.lightweight-accordion-title").first().text();
    if (title.replace(/\s+/g, " ").trim() === "มาตรฐานโครงการรถไฟความเร็วสูง") {
      $accordion.remove();
      return false;
    }
  });

  return $.root().html() ?? "";
}

export function extractRailStandardsCards(html: string): {
  cardsHtml: string;
  restHtml: string;
} {
  const $ = load(html, null, false);
  const cardAccordions = $(".rtrda-rail-standards-files")
    .closest(".lightweight-accordion")
    .toArray();
  const cardsHtml = cardAccordions.map((accordion) => $.html(accordion)).join("");
  cardAccordions.forEach((accordion) => $(accordion).remove());

  return { cardsHtml, restHtml: $.root().html() ?? "" };
}

export function buildHighSpeedRailPdfReaderTargets(): PdfReaderTarget[] {
  return additionalHighSpeedRailStandardDocuments.map((document) => ({
    sourceHref: document.previewHref,
    inlineHref: document.previewHref,
    downloadHref: document.downloadHref,
    title: `สทร. ${document.code} ${document.year ?? "2568"} ${document.title}`,
    kind: "upload",
  }));
}
