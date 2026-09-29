import { describe, expect, it } from "vitest";
import { buildPdfReaderTargets } from "./pdf-reader";
import { buildKnowledgeDocumentGroups } from "./knowledge-documents";
import type { WpContentRecord } from "./types";
import {
  applyPublicHearingDocumentsOverride,
  PUBLIC_HEARING_DOCUMENT_HREF,
} from "./public-hearing-documents";

function record(overrides: Partial<WpContentRecord> = {}): WpContentRecord {
  return {
    id: "th-page-6524",
    wpId: "6524",
    language: "th",
    kind: "page",
    path: "/ประชาพิจารณ์",
    sourceUrl: "https://www.rtrda.or.th/ประชาพิจารณ์",
    title: "ประชาพิจารณ์",
    excerpt: "",
    contentHtml: `<div class="lightweight-accordion"><details><summary class="lightweight-accordion-title"><strong>2569</strong></summary><div class="lightweight-accordion-body"><div class="wp-block-columns"><div class="wp-block-column"></div></div></div></details></div>`,
    modified: "2026-09-29T00:00:00",
    date: "2026-09-29T00:00:00",
    parentPath: null,
    categoryIds: [],
    featuredMediaId: null,
    ...overrides,
  };
}

describe("public hearing document card", () => {
  it("renders the 2569 document as a knowledge-style card with preview and download", async () => {
    const updated = applyPublicHearingDocumentsOverride(record({}));
    const groups = buildKnowledgeDocumentGroups(updated.contentHtml);
    const targets = await buildPdfReaderTargets(updated.contentHtml, {
      resolveDownload: async () => null,
      resolveFlipbookPdf: async () => null,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ title: "2569" });
    expect(groups[0].documents[0]).toMatchObject({
      title: "สทร.-SS-1001:2569",
      description:
        "มาตรฐานว่าด้วยการอพยพผู้ใช้บริการขนส่งทางราง กรณีเกิดเหตุอัคคีภัยหรือกรณีฉุกเฉิน",
      previewHref: PUBLIC_HEARING_DOCUMENT_HREF,
      downloadHref: PUBLIC_HEARING_DOCUMENT_HREF,
      hasUsableTarget: true,
    });
    expect(targets).toEqual([
      {
        sourceHref: PUBLIC_HEARING_DOCUMENT_HREF,
        inlineHref: `${PUBLIC_HEARING_DOCUMENT_HREF}?inline=1`,
        downloadHref: PUBLIC_HEARING_DOCUMENT_HREF,
        title: "อ่านเพิ่มเติม",
        kind: "upload",
      },
    ]);
  });

  it("is idempotent and leaves other pages unchanged", () => {
    const once = applyPublicHearingDocumentsOverride(record({}));
    expect(applyPublicHearingDocumentsOverride(once)).toBe(once);

    const unrelated = record({ path: "/คลังความรู้" });
    expect(applyPublicHearingDocumentsOverride(unrelated)).toBe(unrelated);
  });
});
