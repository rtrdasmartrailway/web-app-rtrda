import { describe, expect, it } from "vitest";
import {
  CATEGORY,
  classifyComparison,
  detectRenderedPageKind,
  extractFlipbookPdfPath,
  extractPageSignals,
  extractRtrdaUrls,
  extractSitemapLocs,
  normalizeTitle,
  normalizeUrlKey,
  shouldAuditPath,
  summarizeResults,
  trigramSimilarity,
} from "./audit-parity-helpers.mjs";

describe("normalizeUrlKey", () => {
  it("decodes Thai segments and strips trailing slashes", () => {
    expect(
      normalizeUrlKey(
        "https://www.rtrda.or.th/%E0%B9%80%E0%B8%81%E0%B8%B5%E0%B9%88%E0%B8%A2%E0%B8%A7%E0%B8%81%E0%B8%B1%E0%B8%9A-%E0%B8%AA%E0%B8%97%E0%B8%A3/",
      ),
    ).toBe("/เกี่ยวกับ-สทร");
  });

  it("drops insignificant query strings", () => {
    expect(normalizeUrlKey("https://www.rtrda.or.th/en/?utm_source=x")).toBe("/en");
  });

  it("keeps search queries", () => {
    expect(normalizeUrlKey("https://www.rtrda.or.th/?s=ราง")).toBe("/?s=ราง");
  });

  it("keeps download keys with query", () => {
    expect(normalizeUrlKey("https://www.rtrda.or.th/sdc_download/123/?key=abc")).toBe(
      "/sdc_download/123?key=abc",
    );
  });

  it("handles relative paths", () => {
    expect(normalizeUrlKey("/category/x/page/2")).toBe("/category/x/page/2");
  });

  it("returns null for garbage", () => {
    expect(normalizeUrlKey("not a url ://")).toBe(null);
    expect(normalizeUrlKey("")).toBe(null);
  });
});

describe("shouldAuditPath", () => {
  it("audits normal routes", () => {
    expect(shouldAuditPath("/เกี่ยวกับ-สทร")).toBe(true);
  });

  it("audits sdc_download routes despite importer ignore list", () => {
    expect(shouldAuditPath("/sdc_download/123")).toBe(true);
  });

  it("skips wp-admin and feeds", () => {
    expect(shouldAuditPath("/wp-admin/index.php")).toBe(false);
    expect(shouldAuditPath("/category/x/feed")).toBe(false);
  });
});

describe("extractSitemapLocs", () => {
  it("extracts loc entries", () => {
    const xml = `<?xml version="1.0"?><urlset><url><loc>https://www.rtrda.or.th/a</loc></url><url><loc>https://www.rtrda.or.th/b</loc></url></urlset>`;
    expect(extractSitemapLocs(xml)).toEqual([
      "https://www.rtrda.or.th/a",
      "https://www.rtrda.or.th/b",
    ]);
  });
});

describe("extractRtrdaUrls", () => {
  it("finds TH and EN urls in markdown", () => {
    const md = "├── หน้าแรก [https://www.rtrda.or.th/] [EN: https://www.rtrda.or.th/en/]";
    expect(extractRtrdaUrls(md)).toEqual([
      "https://www.rtrda.or.th/",
      "https://www.rtrda.or.th/en/",
    ]);
  });
});

describe("normalizeTitle", () => {
  it("strips old WordPress suffix", () => {
    expect(
      normalizeTitle("ความเป็นมา - สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน)"),
    ).toBe("ความเป็นมา");
  });

  it("strips new app suffix", () => {
    expect(normalizeTitle("ความเป็นมา | RTRDA")).toBe("ความเป็นมา");
  });
});

describe("detectRenderedPageKind", () => {
  it("detects the current Next.js content container", () => {
    expect(detectRenderedPageKind('<main class="content-main">News</main>')).toBe("new");
  });

  it("keeps legacy WordPress markup on old selectors", () => {
    expect(detectRenderedPageKind('<div class="siteContent">Legacy</div>')).toBe("old");
  });
});

describe("extractPageSignals", () => {
  const oldHtml = `
    <html><head><title>ความเป็นมา - สทร.</title></head><body>
      <nav>เมนูหลัก</nav>
      <div class="siteContent">
        <h1>ความเป็นมา</h1>
        <p>สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง</p>
        <a href="/wp-content/uploads/2024/01/doc.pdf">เอกสาร</a>
        <img src="https://www.rtrda.or.th/wp-content/uploads/2024/01/pic.jpg" />
        <script>var x = 1;</script>
      </div>
      <footer>ที่อยู่</footer>
    </body></html>`;

  it("extracts main content from old theme using .siteContent", () => {
    const signals = extractPageSignals(oldHtml, "old");
    expect(signals.h1).toBe("ความเป็นมา");
    expect(signals.text).toContain("สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง");
    expect(signals.text).not.toContain("เมนูหลัก");
    expect(signals.text).not.toContain("var x");
    expect(signals.uploadRefs).toEqual(
      expect.arrayContaining([
        "/wp-content/uploads/2024/01/doc.pdf",
        "/wp-content/uploads/2024/01/pic.jpg",
      ]),
    );
  });

  it("falls back to body when no selector matches", () => {
    const signals = extractPageSignals("<html><body><p>hello</p></body></html>", "new");
    expect(signals.text).toBe("hello");
  });
});

describe("extractFlipbookPdfPath", () => {
  it("decodes FB3D_CLIENT_DATA payload to the PDF path", () => {
    const payload = Buffer.from(
      JSON.stringify({
        posts: {
          6640: {
            data: {
              guid: "https://www.rtrda.or.th/wp-content/uploads/2025/10/ANNUAL-REPORT_Ebook-Page.pdf",
            },
          },
        },
      }),
    ).toString("base64");
    const html = `<script>window.FB3D_CLIENT_DATA.push('${payload}');</script>`;
    expect(extractFlipbookPdfPath(html)).toBe(
      "/wp-content/uploads/2025/10/ANNUAL-REPORT_Ebook-Page.pdf",
    );
  });

  it("returns null when no payload exists", () => {
    expect(extractFlipbookPdfPath("<html></html>")).toBe(null);
  });
});

describe("trigramSimilarity", () => {
  it("returns 1 for identical Thai text", () => {
    expect(trigramSimilarity("การรถไฟแห่งประเทศไทย", "การรถไฟแห่งประเทศไทย")).toBe(1);
  });

  it("returns high similarity for content with extra chrome", () => {
    const body =
      "สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง ก่อตั้งขึ้นเพื่อพัฒนาระบบขนส่งทางราง".repeat(
        5,
      );
    const withChrome = `หน้าแรก ข่าวสาร ${body} บทความที่เกี่ยวข้อง`;
    expect(trigramSimilarity(body, withChrome)).toBeGreaterThan(0.7);
  });

  it("returns low similarity for unrelated text", () => {
    expect(
      trigramSimilarity(
        "สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง",
        "Page not found error 404",
      ),
    ).toBeLessThan(0.1);
  });

  it("handles empty strings", () => {
    expect(trigramSimilarity("", "")).toBe(1);
    expect(trigramSimilarity("มีข้อความ", "")).toBe(0);
  });
});

describe("classifyComparison", () => {
  const base = {
    urlKey: "/เกี่ยวกับ-สทร",
    oldStatus: 200,
    newStatus: 200,
    similarity: 0.9,
    titleSimilarity: 1,
    missingAssets: [],
    searchOk: null,
  };

  it("passes a matching page", () => {
    expect(classifyComparison(base)).toEqual({ category: CATEGORY.PASS, level: "pass" });
  });

  it("fails a missing route", () => {
    expect(classifyComparison({ ...base, newStatus: 404 })).toEqual({
      category: CATEGORY.MISSING_ROUTE,
      level: "fail",
    });
  });

  it("warns on old-side errors instead of failing", () => {
    expect(classifyComparison({ ...base, oldStatus: 503 })).toEqual({
      category: CATEGORY.OLD_SIDE_ERROR,
      level: "warn",
    });
  });

  it("fails low similarity, warns medium similarity", () => {
    expect(classifyComparison({ ...base, similarity: 0.1 }).level).toBe("fail");
    expect(classifyComparison({ ...base, similarity: 0.4 }).level).toBe("warn");
  });

  it("fails when referenced assets are missing", () => {
    expect(
      classifyComparison({ ...base, missingAssets: ["/wp-content/uploads/x.pdf"] }),
    ).toEqual({ category: CATEGORY.MISSING_ASSETS, level: "fail" });
  });

  it("gates search urls on searchOk", () => {
    const search = { ...base, urlKey: "/?s=ราง" };
    expect(classifyComparison({ ...search, searchOk: true }).level).toBe("pass");
    expect(classifyComparison({ ...search, searchOk: false })).toEqual({
      category: CATEGORY.SEARCH_BROKEN,
      level: "fail",
    });
  });
});

describe("summarizeResults", () => {
  it("counts levels and categories", () => {
    const summary = summarizeResults([
      { level: "pass", category: "PASS" },
      { level: "fail", category: "MISSING_ROUTE" },
      { level: "fail", category: "MISSING_ROUTE" },
      { level: "warn", category: "TITLE_MISMATCH" },
    ]);
    expect(summary).toEqual({
      pass: 1,
      warn: 1,
      fail: 2,
      byCategory: { PASS: 1, MISSING_ROUTE: 2, TITLE_MISMATCH: 1 },
    });
  });
});
