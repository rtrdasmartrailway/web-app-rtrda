import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
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

describe("public hearing document table", () => {
  it("renders three ordered draft rows with preview and download links", async () => {
    const updated = applyPublicHearingDocumentsOverride(record({}));
    const sanitizedHtml = sanitizeContentHtml(updated.contentHtml);
    const $ = cheerio.load(sanitizedHtml);
    const table = $(".lightweight-accordion")
      .find("summary")
      .filter((_, element) => $(element).text().includes("2569"))
      .closest("details")
      .find(".wp-block-table table");
    const targets = await buildPdfReaderTargets(sanitizedHtml, {
      resolveDownload: async () => null,
      resolveFlipbookPdf: async () => null,
    });

    expect(
      table
        .find("thead th")
        .map((_, element) => $(element).text())
        .get(),
    ).toEqual(["ลำดับ", "รายการร่างมาตรฐาน", "เอกสาร"]);
    expect(table.find("tbody tr")).toHaveLength(3);
    expect(
      table
        .find("tbody tr")
        .toArray()
        .map((element) =>
          $(element)
            .find("td")
            .eq(1)
            .find("p")
            .toArray()
            .map((paragraph) => $(paragraph).text()),
        ),
    ).toEqual(
      PUBLIC_HEARING_DOCUMENTS.map(({ code, title }) => [
        `(ร่าง) ${code}`,
        `(ร่าง) ${title}`,
      ]),
    );
    expect(
      table
        .find("a[download]")
        .map((_, element) => $(element).attr("href"))
        .get(),
    ).toEqual(PUBLIC_HEARING_DOCUMENTS.map(({ href }) => href));
    expect(buildKnowledgeDocumentGroups(sanitizedHtml)).toEqual([]);
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
