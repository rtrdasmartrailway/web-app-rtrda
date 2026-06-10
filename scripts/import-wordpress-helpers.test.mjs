import { describe, expect, it } from "vitest";

import {
  createDownloadAssetRecord,
  extractDownloadLinks,
  extractLinksFromRecords,
  getReferencedUploadPaths,
  rewriteUrl,
} from "./import-wordpress-helpers.mjs";

describe("WordPress importer helpers", () => {
  it("collects absolute and relative upload links for mirroring without adding them as routes", () => {
    const records = [
      {
        contentHtml: `
          <a href="https://www.rtrda.or.th/wp-content/uploads/2026/05/source.pdf">absolute</a>
          <a href="/wp-content/uploads/2026/05/903_12  21.05.69.pdf">relative</a>
          <a href="/เกี่ยวกับ-สทร">page</a>
        `,
      },
    ];

    const discovered = extractLinksFromRecords(records);

    expect(discovered.paths).toEqual(["/เกี่ยวกับ-สทร"]);
    expect(discovered.uploadUrls).toEqual([
      "https://www.rtrda.or.th/wp-content/uploads/2026/05/source.pdf",
      "https://www.rtrda.or.th/wp-content/uploads/2026/05/903_12%20%2021.05.69.pdf",
    ]);
  });

  it("returns referenced upload paths with original decoded filenames for validation", () => {
    const records = [
      {
        contentHtml: `
          <a href="/wp-content/uploads/2026/05/903_12  21.05.69.pdf">PDF</a>
          <img src="https://www.rtrda.or.th/wp-content/uploads/2026/05/photo.jpg" alt="">
        `,
      },
    ];

    expect(getReferencedUploadPaths(records).sort()).toEqual([
      "/wp-content/uploads/2026/05/903_12  21.05.69.pdf",
      "/wp-content/uploads/2026/05/photo.jpg",
    ].sort());
  });

  it("collects keyed download plugin links with document context", () => {
    const links = extractDownloadLinks(
      `
        <div class="lightweight-accordion">
          <details open>
            <summary class="lightweight-accordion-title"><span><strong>รายงานประจำปี</strong></span></summary>
            <div class="lightweight-accordion-body">
              <div class="wp-block-column">
                <h6><strong>รายงานประจำปี 2566</strong></h6>
                <p id="simple-download-counter-5540" class="simple-download-counter">
                  <a class="simple-download-counter-link" href="https://www.rtrda.or.th/sdc_download/5540/?key=abc123">ดาวน์โหลดไฟล์</a>
                </p>
              </div>
            </div>
          </details>
        </div>
      `,
      "/คลังความรู้",
    );

    expect(links).toEqual([
      {
        id: "5540",
        sourceUrl: "https://www.rtrda.or.th/sdc_download/5540/?key=abc123",
        title: "รายงานประจำปี 2566",
        group: "รายงานประจำปี",
        sourcePage: "/คลังความรู้",
      },
    ]);
  });

  it("keeps sdc download paths out of route candidates", () => {
    const discovered = extractLinksFromRecords([
      {
        contentHtml: `
          <a href="/sdc_download/5540">ดาวน์โหลดไฟล์</a>
          <a href="/เกี่ยวกับ-สทร">page</a>
        `,
      },
    ]);

    expect(discovered.paths).toEqual(["/เกี่ยวกับ-สทร"]);
  });

  it("rewrites Thai and English download plugin links to the same local route", () => {
    expect(
      rewriteUrl("https://www.rtrda.or.th/sdc_download/5540/?key=abc123"),
    ).toBe("/sdc_download/5540");
    expect(
      rewriteUrl("https://www.rtrda.or.th/en/sdc_download/5540/?key=abc123"),
    ).toBe("/sdc_download/5540");
    expect(rewriteUrl("/en/sdc_download/5540?key=abc123")).toBe(
      "/sdc_download/5540",
    );
  });

  it("builds download asset records with deterministic local paths", () => {
    expect(
      createDownloadAssetRecord({
        id: "5540",
        sourceUrl: "https://www.rtrda.or.th/sdc_download/5540/?key=abc123",
        fileName: "RTRDA_AR_2023-รวมเล่ม.pdf",
        mimeType: "application/pdf",
        sizeBytes: 29384913,
        title: "รายงานประจำปี 2566",
        group: "รายงานประจำปี",
        sourcePages: ["/คลังความรู้", "/คลังความรู้", "/en/คลังความรู้"],
      }),
    ).toEqual({
      id: "5540",
      sourceUrl: "https://www.rtrda.or.th/sdc_download/5540/?key=abc123",
      localPath: "/sdc-downloads/5540.pdf",
      fileName: "RTRDA_AR_2023-รวมเล่ม.pdf",
      mimeType: "application/pdf",
      sizeBytes: 29384913,
      title: "รายงานประจำปี 2566",
      group: "รายงานประจำปี",
      sourcePages: ["/คลังความรู้", "/en/คลังความรู้"],
    });
  });
});
