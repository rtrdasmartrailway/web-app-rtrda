import { describe, expect, it } from "vitest";
import {
  buildPdfReaderTargets,
  extractIframePdfSource,
  extractPdfReaderLinks,
} from "./pdf-reader";

describe("PDF reader helpers", () => {
  it("extracts download, direct PDF, and flipbook links while ignoring non-PDF links", () => {
    const links = extractPdfReaderLinks(`
      <a href="/sdc_download/5540">ดาวน์โหลดไฟล์</a>
      <a href="/wp-content/uploads/2026/05/file.pdf">PDF</a>
      <a href="/3d-flip-book/6267">อ่านเพิ่มเติม</a>
      <a href="/wp-content/uploads/2023/04/logo.zip">ZIP</a>
      <a href="https://example.com/file.pdf">external</a>
      <a href="http://119.63.69.36/wp-content/uploads/2024/11/legacy.pdf">legacy RTRDA PDF</a>
    `);

    expect(links.map((link) => link.href)).toEqual([
      "/sdc_download/5540",
      "/wp-content/uploads/2026/05/file.pdf",
      "/3d-flip-book/6267",
      "/wp-content/uploads/2024/11/legacy.pdf",
    ]);
  });

  it("builds an inline target for mirrored WordPress downloads", async () => {
    const targets = await buildPdfReaderTargets(
      '<a href="/sdc_download/5540">ดาวน์โหลดไฟล์</a>',
      {
        resolveDownload: async (id) => ({
          id,
          sourceUrl: "https://www.rtrda.or.th/sdc_download/5540/?key=x",
          localPath: "/sdc-downloads/5540.pdf",
          fileName: "RTRDA_AR_2023-รวมเล่ม.pdf",
          mimeType: "application/octet-stream",
          sizeBytes: 29384913,
          title: "รายงานประจำปี 2566",
          group: "รายงานประจำปี",
          sourcePages: ["/คลังความรู้"],
        }),
        resolveFlipbookPdf: async () => null,
      },
    );

    expect(targets).toEqual([
      {
        sourceHref: "/sdc_download/5540",
        inlineHref: "/sdc_download/5540?inline=1",
        downloadHref: "/sdc_download/5540",
        title: "รายงานประจำปี 2566",
        kind: "download",
      },
    ]);
  });

  it("builds a reader target for direct imported PDF uploads", async () => {
    const targets = await buildPdfReaderTargets(
      '<a href="/wp-content/uploads/2026/05/903_12  21.05.69.pdf">PDF</a>',
      {
        resolveDownload: async () => null,
        resolveFlipbookPdf: async () => null,
      },
    );

    expect(targets).toEqual([
      {
        sourceHref: "/wp-content/uploads/2026/05/903_12  21.05.69.pdf",
        inlineHref: "/wp-content/uploads/2026/05/903_12  21.05.69.pdf",
        downloadHref: "/wp-content/uploads/2026/05/903_12  21.05.69.pdf",
        title: "PDF",
        kind: "upload",
      },
    ]);
  });

  it("resolves a flipbook link to the PDF embedded in the imported flipbook page", async () => {
    const targets = await buildPdfReaderTargets(
      '<a href="/3d-flip-book/6267">อ่านเพิ่มเติม</a>',
      {
        resolveDownload: async () => null,
        resolveFlipbookPdf: async (path) =>
          path === "/3d-flip-book/6267"
            ? "/wp-content/uploads/2025/07/6001-standard.pdf"
            : null,
      },
    );

    expect(targets).toEqual([
      {
        sourceHref: "/3d-flip-book/6267",
        inlineHref: "/wp-content/uploads/2025/07/6001-standard.pdf",
        downloadHref: "/wp-content/uploads/2025/07/6001-standard.pdf",
        title: "อ่านเพิ่มเติม",
        kind: "flipbook",
      },
    ]);
  });

  it("uses the resolved flipbook title when available", async () => {
    const targets = await buildPdfReaderTargets(
      '<a href="/3d-flip-book/6267">อ่านเพิ่มเติม</a>',
      {
        resolveDownload: async () => null,
        resolveFlipbookPdf: async () => ({
          pdfPath: "/wp-content/uploads/2025/07/6001-standard.pdf",
          title: "สทร. CT-6001:2568",
        }),
      },
    );

    expect(targets[0].title).toBe("สทร. CT-6001:2568");
  });

  it("extracts the PDF src from imported flipbook iframe HTML", () => {
    expect(
      extractIframePdfSource(
        '<div><iframe src="/wp-content/uploads/2025/07/6001.pdf"></iframe></div>',
      ),
    ).toBe("/wp-content/uploads/2025/07/6001.pdf");
  });
});
