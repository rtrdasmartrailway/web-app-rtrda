import { load } from "cheerio";
import type { PdfReaderTarget } from "./pdf-reader";
import { normalizeRoutePath } from "./url";

export interface HighSpeedRailStandardDocument {
  code: string;
  title: string;
  coverImage: string;
  pdfHref: string;
}

const assetBase = "/standards/high-speed-rail";

export function isRailStandardsPath(path: string): boolean {
  const normalized = normalizeRoutePath(path).normalize("NFC");
  return normalized === "/มาตรฐานระบบราง-สทร" || normalized === "/en/มาตรฐานระบบราง-สทร";
}

export const highSpeedRailStandardDocuments: HighSpeedRailStandardDocument[] = [
  {
    code: "HSR-CT-1001",
    title: "มาตรฐานงานสำรวจ",
    coverImage: `${assetBase}/hsr-ct-1001-2568.png`,
    pdfHref: `${assetBase}/hsr-ct-1001-2568.pdf`,
  },
  {
    code: "HSR-CT-1002",
    title: "มาตรฐานงานป้องกันน้ำ",
    coverImage: `${assetBase}/hsr-ct-1002-2568.png`,
    pdfHref: `${assetBase}/hsr-ct-1002-2568.pdf`,
  },
  {
    code: "HSR-CT-3001",
    title: "มาตรฐานงานเจาะและระเบิด",
    coverImage: `${assetBase}/hsr-ct-3001-2568.png`,
    pdfHref: `${assetBase}/hsr-ct-3001-2568.pdf`,
  },
  {
    code: "HSR-CT-4012",
    title: "มาตรฐานงานตรวจวัด",
    coverImage: `${assetBase}/hsr-ct-4012-2568.png`,
    pdfHref: `${assetBase}/hsr-ct-4012-2568.pdf`,
  },
  {
    code: "HSR-CT-5001",
    title: "มาตรฐานงานค้ำยัน",
    coverImage: `${assetBase}/hsr-ct-5001-2568.png`,
    pdfHref: `${assetBase}/hsr-ct-5001-2568.pdf`,
  },
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

export function buildHighSpeedRailPdfReaderTargets(): PdfReaderTarget[] {
  return highSpeedRailStandardDocuments.map((document) => ({
    sourceHref: document.pdfHref,
    inlineHref: document.pdfHref,
    downloadHref: document.pdfHref,
    title: `สทร. ${document.code} 2568 ${document.title}`,
    kind: "upload",
  }));
}
