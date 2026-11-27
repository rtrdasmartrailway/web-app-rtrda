import { describe, expect, it } from "vitest";
import { sanitizeContentHtml } from "@/lib/security/sanitize-content";
import { buildPdfReaderTargets } from "./pdf-reader";
import { buildKnowledgeDocumentGroups } from "./knowledge-documents";
import type { WpContentRecord } from "./types";
import {
  applyPublicHearingDocumentsOverride,
  PUBLIC_HEARING_DOCUMENTS,
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
    contentHtml: `<div class="lightweight-accordion"><details><summary class="lightweight-accordion-title"><strong>2569</strong></summary><div class="lightweight-accordion-body"><div class="wp-block-columns"><div class="wp-block-column"><h6>(ร่าง) สทร.-SS-1001:2569</h6><p>มาตรฐานเดิม</p><a href="/public-hearing-documents/ss-1001-2569-evacuation.pdf">ดาวน์โหลดไฟล์</a></div></div></div></details></div>`,
    modified: "2026-09-29T00:00:00",
    date: "2026-09-29T00:00:00",
    parentPath: null,
    categoryIds: [],
    featuredMediaId: null,
    ...overrides,
  };
}

describe("public hearing document cards", () => {
  it("renders three ordered draft cards using the standard knowledge grid", async () => {
    const updated = applyPublicHearingDocumentsOverride(record({}));
    const sanitizedHtml = sanitizeContentHtml(updated.contentHtml);
    const groups = buildKnowledgeDocumentGroups(sanitizedHtml);
    const targets = await buildPdfReaderTargets(sanitizedHtml, {
      resolveDownload: async () => null,
      resolveFlipbookPdf: async () => null,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ title: "2569", open: false });
    expect(groups[0].compact).not.toBe(true);
    expect(groups[0].documents).toHaveLength(3);
    expect(
      groups[0].documents.map(
        ({ title, description, coverImage, previewHref, downloadHref }) => ({
          title,
          description,
          coverImage,
          previewHref,
          downloadHref,
        }),
      ),
    ).toEqual(
      PUBLIC_HEARING_DOCUMENTS.map(({ code, title, href, coverImage }) => ({
        title: `(ร่าง) ${code}`,
        description: `(ร่าง) ${title}`,
        coverImage,
        previewHref: href,
        downloadHref: href,
      })),
    );
    expect(groups[0].documents.every(({ hasUsableTarget }) => hasUsableTarget)).toBe(
      true,
    );
    expect(updated.contentHtml).not.toContain("SS-1001");
    expect(targets).toEqual(
      PUBLIC_HEARING_DOCUMENTS.map(({ href }) => ({
        sourceHref: href,
        inlineHref: `${href}?inline=1`,
        downloadHref: href,
        title: "อ่านเพิ่มเติม",
        kind: "upload",
      })),
    );
  });

  it("is idempotent and leaves other pages unchanged", () => {
    const once = applyPublicHearingDocumentsOverride(record({}));
    expect(applyPublicHearingDocumentsOverride(once)).toBe(once);

    const unrelated = record({ path: "/คลังความรู้" });
    expect(applyPublicHearingDocumentsOverride(unrelated)).toBe(unrelated);
  });
});
