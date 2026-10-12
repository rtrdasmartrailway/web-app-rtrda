import { describe, expect, it } from "vitest";
import {
  createContentIdeasCsv,
  createContentIdeasWordHtml,
  type ContentIdeaExportRow,
} from "./idea-export";

const row: ContentIdeaExportRow = {
  id: "IDEA-001",
  title: 'ถาม "อะไร"',
  summary: "รายละเอียด, บรรทัดสอง\nต่อ",
  channels: "Facebook, YouTube",
  priority: "สำคัญ",
  status: "เสนอแล้ว",
  author: "ผู้เสนอ",
  links: ["https://example.test/a?x=1&y=2"],
};

describe("Content Ideas exports", () => {
  it("creates UTF-8 BOM CSV with correctly escaped fields", () => {
    const csv = createContentIdeasCsv([row]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"ถาม ""อะไร"""');
    expect(csv).toContain('"รายละเอียด, บรรทัดสอง\nต่อ"');
    expect(csv).toContain('"https://example.test/a?x=1&y=2"');
  });

  it("prefixes formula-like spreadsheet cells to prevent formula execution", () => {
    const csv = createContentIdeasCsv([{ ...row, title: '=HYPERLINK("x")' }]);
    expect(csv).toContain("'=HYPERLINK(");
  });

  it("escapes user content in Word-compatible HTML", () => {
    const html = createContentIdeasWordHtml([
      { ...row, title: "<script>alert(1)</script>", links: ["https://x.test/?a=1&b=2"] },
    ]);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("https://x.test/?a=1&amp;b=2");
    expect(html).not.toContain("<script>");
  });
});
