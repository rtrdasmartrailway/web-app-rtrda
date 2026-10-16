import { describe, expect, it } from "vitest";
import { aggregatePlatformDistribution, parseCsv } from "./platform-distribution-data";

const HEADER = [
  "ลำดับ",
  "หัวข้อ",
  "ผู้ชม",
  "คอมเม้น",
  "วัน/เดือน/ปี",
  "ผลรวมจำนวนผู้ชม",
  "ผลรวมจำนวนคอมเม้น",
];

function sheetRow(
  sequence: string,
  platform: string,
  viewers: string,
  comments: string,
  date = "1/10/2026",
): string[] {
  return [sequence, platform, viewers, comments, date, "", ""];
}

describe("platform distribution spreadsheet data", () => {
  it("parses quoted commas, escaped quotes, and newlines", () => {
    expect(parseCsv('"topic, here","say ""hi""\nthere"\r\n1,Facebook\r\n')).toEqual([
      ["topic, here", 'say "hi"\nthere'],
      ["1", "Facebook"],
    ]);
  });

  it("aggregates records by platform for posts, viewers, and comments", () => {
    const result = aggregatePlatformDistribution(
      [
        HEADER,
        sheetRow("1", "Facebook", "1,200", "20"),
        sheetRow("2", "Facebook", "300", "5"),
        sheetRow("3", "YouTube", "900", "10"),
      ],
      "2026-10-17T00:00:00.000Z",
    );

    expect(result).toMatchObject({
      fetchedAt: "2026-10-17T00:00:00.000Z",
      recordCount: 3,
      totals: { posts: 3, viewers: 2400, comments: 35 },
      platforms: [
        { name: "Facebook", posts: 2, viewers: 1500, comments: 25 },
        { name: "Website", posts: 0, viewers: 0, comments: 0 },
        { name: "Press Release", posts: 0, viewers: 0, comments: 0 },
        { name: "YouTube", posts: 1, viewers: 900, comments: 10 },
        { name: "LinkedIn", posts: 0, viewers: 0, comments: 0 },
        { name: "Internal", posts: 0, viewers: 0, comments: 0 },
        { name: "TikTok", posts: 0, viewers: 0, comments: 0 },
      ],
    });
  });

  it("ignores empty rows and reports rows without a recognized platform", () => {
    const result = aggregatePlatformDistribution([
      HEADER,
      ["", "", "", "", "", "", "", ""],
      sheetRow("1", "Other", "100", "2"),
    ]);
    expect(result.recordCount).toBe(0);
    expect(result.unclassifiedRows).toBe(1);
    expect(result.totals).toEqual({ posts: 0, viewers: 0, comments: 0 });
  });

  it("rejects a missing template header or malformed numeric values", () => {
    expect(() => aggregatePlatformDistribution([["หัวข้อ", "ผู้ชม"]])).toThrow(
      "headers do not match",
    );
    expect(() =>
      aggregatePlatformDistribution([HEADER, sheetRow("1", "TikTok", "1x", "0")]),
    ).toThrow("Invalid numeric value");
  });

  it("counts one row as one post with or without the old จำนวน column, regardless of row order", () => {
    const oldHeader = ["ลำดับ", "หัวข้อ", "จำนวน", "ผู้ชม", "คอมเม้น", "วัน/เดือน/ปี"];
    const result = aggregatePlatformDistribution([
      oldHeader,
      ["2", "YouTube", "999", "20", "2", "16/10/2026"],
      ["1", "Facebook", "999", "10", "1", "17/10/2026"],
    ]);
    expect(result.totals).toEqual({ posts: 2, viewers: 30, comments: 3 });
  });

  it("filters by Bangkok calendar days and platform, excluding invalid or future dates", () => {
    const rows = [
      HEADER,
      sheetRow("1", "Facebook", "10", "1", "17/10/2026"),
      sheetRow("2", "YouTube", "20", "2", "16/10/2026"),
      sheetRow("3", "Facebook", "30", "3", "17/9/2026"),
      sheetRow("4", "Facebook", "40", "4", "18/10/2026"),
      sheetRow("5", "Facebook", "50", "5", "31/9/2026"),
    ];
    const at = "2026-10-17T02:00:00.000Z";
    expect(aggregatePlatformDistribution(rows, at, { period: "30" }).totals.posts).toBe(
      2,
    );
    expect(
      aggregatePlatformDistribution(rows, at, { period: "7", platform: "Facebook" })
        .totals,
    ).toEqual({ posts: 1, viewers: 10, comments: 1 });
  });

  it("labels the source sheet's sample rows as test data", () => {
    const result = aggregatePlatformDistribution([
      [...HEADER, "⚠️ ข้อมูลตัวอย่างสมมติ 12 แถว"],
      sheetRow("1", "Facebook", "10", "1"),
    ]);
    expect(result.sampleData).toBe(true);
  });
});
