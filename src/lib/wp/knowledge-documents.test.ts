import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { WpImportManifest } from "./types";
import { buildKnowledgeDocumentGroups } from "./knowledge-documents";

const validDownloads = new Set(["5540", "5544", "5552"]);

describe("knowledge document parser", () => {
  it("uses a valid download as preview fallback when the read-more href is empty", () => {
    const groups = buildKnowledgeDocumentGroups(
      `
      <div class="lightweight-accordion">
        <details open>
          <summary class="lightweight-accordion-title"><h1>รายงาน</h1></summary>
          <div class="lightweight-accordion-body">
            <div class="wp-block-columns">
              <div class="wp-block-column">
                <figure><img src="/wp-content/uploads/cover.png" alt="cover"></figure>
                <h6><strong>รายงานการพัฒนามาตรฐานระบบราง</strong></h6>
                <div class="wp-block-button detail-btn">
                  <a class="wp-block-button__link" href="">อ่านเพิ่มเติม</a>
                </div>
                <p id="simple-download-counter-5544" class="simple-download-counter">
                  <a class="simple-download-counter-link" href="/sdc_download/5544">ดาวน์โหลดไฟล์</a>
                </p>
              </div>
            </div>
          </div>
        </details>
      </div>
      `,
      { validDownloadIds: validDownloads },
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ title: "รายงาน", open: true });
    expect(groups[0].documents[0]).toMatchObject({
      title: "รายงานการพัฒนามาตรฐานระบบราง",
      coverImage: "/wp-content/uploads/cover.png",
      previewHref: "/sdc_download/5544",
      downloadHref: "/sdc_download/5544",
    });
  });

  it("uses direct PDF links for both preview and download actions", () => {
    const groups = buildKnowledgeDocumentGroups(
      `
      <div class="lightweight-accordion">
        <details>
          <summary class="lightweight-accordion-title">ร่างมาตรฐาน</summary>
          <div class="lightweight-accordion-body">
            <div class="wp-block-columns">
              <div class="wp-block-column">
                <img src="/wp-content/uploads/cover.jpg" alt="">
                <h6>สทร. HSR-CT-1001:2568</h6>
                <p class="has-text-align-center">(ร่าง) มาตรฐานงานสำรวจ</p>
                <div class="wp-block-button detail-btn">
                  <a class="wp-block-button__link" href="/wp-content/uploads/2025/12/draft.pdf">อ่านเพิ่มเติม</a>
                </div>
              </div>
            </div>
          </div>
        </details>
      </div>
      `,
      { validDownloadIds: validDownloads },
    );

    expect(groups[0].documents[0]).toMatchObject({
      title: "สทร. HSR-CT-1001:2568",
      description: "(ร่าง) มาตรฐานงานสำรวจ",
      previewHref: "/wp-content/uploads/2025/12/draft.pdf",
      downloadHref: "/wp-content/uploads/2025/12/draft.pdf",
    });
  });

  it("parses the BEMU station survey report in the project reports group", () => {
    const groups = buildKnowledgeDocumentGroups(`
      <div class="lightweight-accordion">
        <details open>
          <summary class="lightweight-accordion-title">รายงานผลงานโครงการ</summary>
          <div class="lightweight-accordion-body">
            <div class="wp-block-columns">
              <div class="wp-block-column">
                <figure><img src="/wp-content/uploads/2026/07/bemu-station-survey-report-cover.png" alt="รายงานการสำรวจพื้นที่สถานีเพื่อพิจารณาความเป็นไปได้ในการติดตั้งสถานีชาร์จรถไฟโดยสารพลังงานแบตเตอรี่ (สถานีบ้านแหลม และ สถานีแม่กลอง)"></figure>
                <h6>รายงานการสำรวจพื้นที่สถานีเพื่อพิจารณาความเป็นไปได้ในการติดตั้งสถานีชาร์จรถไฟโดยสารพลังงานแบตเตอรี่ (สถานีบ้านแหลม และ สถานีแม่กลอง)</h6>
                <p>โครงการวิจัยและพัฒนารถไฟโดยสารพลังงานไฟฟ้าจากแบตเตอรี่เพื่อลดมลพิษในการเดินรถเข้าสู่ชุมชน</p>
                <div class="wp-block-button detail-btn"><a href="/wp-content/uploads/2026/07/bemu-station-survey-report-bl-mk.pdf">อ่านเพิ่มเติม</a></div>
                <p class="simple-download-counter"><a class="simple-download-counter-link" href="/wp-content/uploads/2026/07/bemu-station-survey-report-bl-mk.pdf">ดาวน์โหลดไฟล์</a></p>
              </div>
            </div>
          </div>
        </details>
      </div>
    `);

    expect(groups[0]).toMatchObject({ title: "รายงานผลงานโครงการ" });
    expect(groups[0].documents[0]).toMatchObject({
      title:
        "รายงานการสำรวจพื้นที่สถานีเพื่อพิจารณาความเป็นไปได้ในการติดตั้งสถานีชาร์จรถไฟโดยสารพลังงานแบตเตอรี่ (สถานีบ้านแหลม และ สถานีแม่กลอง)",
      description:
        "โครงการวิจัยและพัฒนารถไฟโดยสารพลังงานไฟฟ้าจากแบตเตอรี่เพื่อลดมลพิษในการเดินรถเข้าสู่ชุมชน",
      coverImage: "/wp-content/uploads/2026/07/bemu-station-survey-report-cover.png",
      downloadHref: "/wp-content/uploads/2026/07/bemu-station-survey-report-bl-mk.pdf",
      previewHref: "/wp-content/uploads/2026/07/bemu-station-survey-report-bl-mk.pdf",
    });
  });

  it("uses image-only infographic links as working preview and download actions", () => {
    const groups = buildKnowledgeDocumentGroups(
      `
      <div class="lightweight-accordion">
        <details>
          <summary class="lightweight-accordion-title">อินโฟกราฟฟิค</summary>
          <div class="lightweight-accordion-body">
            <div class="wp-block-columns">
              <div class="wp-block-column">
                <figure>
                  <a href="/wp-content/uploads/2023/11/info.webp">
                    <img src="/wp-content/uploads/2023/11/info-thumb.webp" alt="info">
                  </a>
                </figure>
                <h6>บทบาท สทร.</h6>
                <div class="wp-block-button detail-btn"><a href="">อ่านเพิ่มเติม</a></div>
              </div>
            </div>
          </div>
        </details>
      </div>
      `,
      { validDownloadIds: validDownloads },
    );

    expect(groups[0].documents[0]).toMatchObject({
      title: "บทบาท สทร.",
      previewHref: "/wp-content/uploads/2023/11/info.webp",
      downloadHref: "/wp-content/uploads/2023/11/info.webp",
    });
  });

  it("keeps placeholder cards visible with disabled actions when no target exists", () => {
    const groups = buildKnowledgeDocumentGroups(
      `
      <div class="lightweight-accordion">
        <details>
          <summary class="lightweight-accordion-title">บทวิเคราะห์</summary>
          <div class="lightweight-accordion-body">
            <div class="wp-block-columns">
              <div class="wp-block-column">
                <img src="/wp-content/uploads/icon.png" alt="">
                <h6>รายงาน…</h6>
                <div class="wp-block-button detail-btn"><a href="">อ่านเพิ่มเติม</a></div>
              </div>
            </div>
          </div>
        </details>
      </div>
      `,
      { validDownloadIds: validDownloads },
    );

    expect(groups[0].documents[0]).toMatchObject({
      title: "รายงาน…",
      previewHref: null,
      downloadHref: null,
      hasUsableTarget: false,
    });
  });

  it("attaches a group-level orphan download to the single visible card", () => {
    const groups = buildKnowledgeDocumentGroups(
      `
      <div class="lightweight-accordion">
        <details>
          <summary class="lightweight-accordion-title">สมุดปกขาว</summary>
          <div class="lightweight-accordion-body">
            <div class="wp-block-columns">
              <div class="wp-block-column">
                <img src="/wp-content/uploads/cover.webp" alt="">
                <h6>การประมาณความต้องการของบุคลากร</h6>
                <div class="wp-block-button detail-btn"><a href="">อ่านเพิ่มเติม</a></div>
              </div>
            </div>
            <p class="simple-download-counter"><a class="simple-download-counter-link" href="/sdc_download/5552">ดาวน์โหลดไฟล์</a></p>
          </div>
        </details>
      </div>
      `,
      { validDownloadIds: validDownloads },
    );

    expect(groups[0].documents[0]).toMatchObject({
      previewHref: "/sdc_download/5552",
      downloadHref: "/sdc_download/5552",
    });
  });

  it("parses the current imported knowledge fixture into eight groups without empty enabled links", async () => {
    const manifest = JSON.parse(
      await readFile("src/data/wp-content.json", "utf8"),
    ) as WpImportManifest;
    const record = manifest.records.find((item) => item.path === "/คลังความรู้");
    const groups = buildKnowledgeDocumentGroups(record?.contentHtml ?? "", {
      validDownloadIds: new Set(manifest.downloads.map((download) => download.id)),
    });

    expect(groups).toHaveLength(8);
    expect(groups.flatMap((group) => group.documents)).toHaveLength(47);
    for (const document of groups.flatMap((group) => group.documents)) {
      expect(document.previewHref).not.toBe("");
      expect(document.downloadHref).not.toBe("");
    }
  });
});
