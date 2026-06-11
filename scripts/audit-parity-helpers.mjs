import * as cheerio from "cheerio";
import {
  decodeSegment,
  extractFlipbookPdfPath,
  getPathFromUrl,
  normalizeRoutePath,
  shouldIgnoreRoute,
} from "./import-wordpress-helpers.mjs";

export const SIMILARITY_PASS = 0.55;
export const SIMILARITY_WARN = 0.3;
export const TITLE_PASS = 0.8;

const rtrdaUrlPattern = /https?:\/\/(?:www\.)?rtrda\.or\.th[^\]\s"'<>)]*/gi;

const OLD_TITLE_SUFFIX =
  /\s*[-–|]\s*(?:สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง.*|Rail Technology Research and Development Agency.*)$/u;
const NEW_TITLE_SUFFIX = /\s*\|\s*(?:RTRDA|สทร\.?).*$/u;

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTitle(value) {
  return normalizeText(value)
    .replace(OLD_TITLE_SUFFIX, "")
    .replace(NEW_TITLE_SUFFIX, "")
    .trim();
}

/**
 * Canonical comparison key for a URL: decoded path segments, no trailing
 * slash, query dropped except for search (`?s=`) and download (`?key=`) URLs
 * where the query is significant.
 */
export function normalizeUrlKey(value) {
  let parsed;
  try {
    parsed = value.startsWith("/")
      ? new URL(value, "https://www.rtrda.or.th")
      : new URL(value);
  } catch {
    return null;
  }

  const routePath = normalizeRoutePath(parsed.pathname).normalize("NFC");
  const searchTerm = parsed.searchParams.get("s");
  if (searchTerm !== null) {
    return `${routePath === "/" ? "" : routePath}/?s=${searchTerm}`;
  }
  if (routePath.includes("/sdc_download/") && parsed.search) {
    return `${routePath}${parsed.search}`;
  }
  return routePath;
}

export function shouldAuditPath(pathname) {
  if (pathname.includes("/sdc_download/")) {
    return true;
  }
  return !shouldIgnoreRoute(pathname);
}

/** Extract `<loc>` entries from a sitemap or sitemap-index XML document. */
export function extractSitemapLocs(xml) {
  const locs = [];
  const pattern = /<loc>([^<]+)<\/loc>/gi;
  let match;
  while ((match = pattern.exec(String(xml ?? ""))) !== null) {
    locs.push(match[1].trim());
  }
  return locs;
}

/** Extract every rtrda.or.th URL mentioned in free text (RTRDA_PAGES.md). */
export function extractRtrdaUrls(text) {
  return Array.from(String(text ?? "").match(rtrdaUrlPattern) ?? []);
}

const STRIP_SELECTORS = "script,style,noscript,nav,header,footer,form,iframe";

// Old Lightning-theme widgets rendered inside .siteContent that are chrome,
// not page content: social follow box, prev/next post links, category badges.
const OLD_CHROME_SELECTORS =
  ".followSet, .followSet_body, .vk_post, .entry-meta, .entry-meta-dataList";

const OLD_CONTENT_SELECTORS = [".siteContent", ".mainSection", "main", "article", "body"];
const NEW_CONTENT_SELECTORS = [".content-main", "main", "body"];

/**
 * Extract comparable signals from a rendered HTML page.
 * `kind` is "old" (WordPress theme) or "new" (Next.js app); the two use
 * different main-content selectors. When no content selector matches
 * (`selector: "body"` fallback), text/asset signals are unreliable —
 * callers should limit themselves to title comparison.
 */
export function extractPageSignals(html, kind) {
  const $ = cheerio.load(String(html ?? ""));
  const title = normalizeText($("title").first().text());
  const h1 = normalizeText($("h1").first().text());

  const selectors = kind === "old" ? OLD_CONTENT_SELECTORS : NEW_CONTENT_SELECTORS;
  let $main = null;
  let matchedSelector = null;
  for (const selector of selectors) {
    const found = $(selector).first();
    if (found.length > 0) {
      $main = found;
      matchedSelector = selector;
      break;
    }
  }

  if (!$main) {
    return {
      title,
      h1,
      text: "",
      linkCount: 0,
      imageCount: 0,
      uploadRefs: [],
      selector: null,
    };
  }

  $main.find(STRIP_SELECTORS).remove();
  if (kind === "old") {
    $main.find(OLD_CHROME_SELECTORS).remove();
  }

  const uploadRefs = new Set();
  let linkCount = 0;
  let imageCount = 0;
  $main.find("a[href]").each((_, el) => {
    const routePath = getPathFromUrl($(el).attr("href"));
    if (routePath) {
      linkCount += 1;
      if (routePath.startsWith("/wp-content/uploads/")) {
        uploadRefs.add(routePath);
      }
    }
  });
  $main.find("img[src]").each((_, el) => {
    imageCount += 1;
    const routePath = getPathFromUrl($(el).attr("src"));
    if (routePath?.startsWith("/wp-content/uploads/")) {
      uploadRefs.add(routePath);
    }
  });

  return {
    title,
    h1,
    text: normalizeText($main.text()),
    linkCount,
    imageCount,
    uploadRefs: Array.from(uploadRefs),
    selector: matchedSelector,
  };
}

function trigramSet(value) {
  const text = normalizeText(value).toLowerCase();
  const grams = new Set();
  for (let i = 0; i <= text.length - 3; i += 1) {
    grams.add(text.slice(i, i + 3));
  }
  return grams;
}

/**
 * Character-trigram containment: the share of `reference` trigrams present in
 * `candidate`. Measures whether the old page's content survives in the new
 * page; extra content on the new page (related-articles sections, richer
 * chrome) does not lower the score. Trigrams work for Thai text, which has no
 * word boundaries, unlike token-based similarity metrics.
 */
export function trigramSimilarity(reference, candidate) {
  const refSet = trigramSet(reference);
  const candidateSet = trigramSet(candidate);
  if (refSet.size === 0) {
    return 1;
  }
  if (candidateSet.size === 0) {
    return 0;
  }
  let shared = 0;
  for (const gram of refSet) {
    if (candidateSet.has(gram)) {
      shared += 1;
    }
  }
  return shared / refSet.size;
}

export const CATEGORY = {
  PASS: "PASS",
  MISSING_ROUTE: "MISSING_ROUTE",
  STATUS_MISMATCH: "STATUS_MISMATCH",
  LOW_SIMILARITY: "LOW_SIMILARITY",
  TITLE_MISMATCH: "TITLE_MISMATCH",
  MISSING_ASSETS: "MISSING_ASSETS",
  SEARCH_BROKEN: "SEARCH_BROKEN",
  FLIPBOOK_BROKEN: "FLIPBOOK_BROKEN",
  OLD_SIDE_ERROR: "OLD_SIDE_ERROR",
};

/**
 * Classify one compared URL. Returns { category, level } where level is
 * "pass" | "warn" | "fail". OLD_SIDE_ERROR is excluded from the failure gate
 * because it means the source site itself misbehaved.
 */
export function classifyComparison({
  urlKey,
  oldStatus,
  newStatus,
  similarity,
  titleSimilarity,
  missingAssets,
  searchOk,
}) {
  if (oldStatus < 200 || oldStatus >= 400) {
    return { category: CATEGORY.OLD_SIDE_ERROR, level: "warn" };
  }
  if (newStatus === 404) {
    return { category: CATEGORY.MISSING_ROUTE, level: "fail" };
  }
  if (newStatus < 200 || newStatus >= 400) {
    return { category: CATEGORY.STATUS_MISMATCH, level: "fail" };
  }
  if (urlKey.includes("?s=")) {
    return searchOk
      ? { category: CATEGORY.PASS, level: "pass" }
      : { category: CATEGORY.SEARCH_BROKEN, level: "fail" };
  }
  if (missingAssets?.length > 0) {
    return { category: CATEGORY.MISSING_ASSETS, level: "fail" };
  }
  if (similarity !== null && similarity < SIMILARITY_WARN) {
    return { category: CATEGORY.LOW_SIMILARITY, level: "fail" };
  }
  if (similarity !== null && similarity < SIMILARITY_PASS) {
    return { category: CATEGORY.LOW_SIMILARITY, level: "warn" };
  }
  if (titleSimilarity !== null && titleSimilarity < TITLE_PASS) {
    return { category: CATEGORY.TITLE_MISMATCH, level: "warn" };
  }
  return { category: CATEGORY.PASS, level: "pass" };
}

export function summarizeResults(results) {
  const summary = { pass: 0, warn: 0, fail: 0, byCategory: {} };
  for (const result of results) {
    summary[result.level] += 1;
    summary.byCategory[result.category] = (summary.byCategory[result.category] ?? 0) + 1;
  }
  return summary;
}

export function renderMarkdownReport(report) {
  const lines = [
    `# Parity audit report`,
    ``,
    `- Generated: ${report.generatedAt}`,
    `- Old base: ${report.oldBase}`,
    `- New base: ${report.newBase}`,
    `- Thresholds: similarity pass ≥ ${SIMILARITY_PASS}, warn ≥ ${SIMILARITY_WARN}, title ≥ ${TITLE_PASS}`,
    `- URLs audited: ${report.results.length}`,
    ``,
    `| Result | Count |`,
    `| --- | --- |`,
    `| pass | ${report.summary.pass} |`,
    `| warn | ${report.summary.warn} |`,
    `| fail | ${report.summary.fail} |`,
    ``,
  ];

  const byCategory = new Map();
  for (const result of report.results) {
    if (result.category === CATEGORY.PASS) continue;
    if (!byCategory.has(result.category)) {
      byCategory.set(result.category, []);
    }
    byCategory.get(result.category).push(result);
  }

  for (const [category, items] of byCategory) {
    lines.push(`## ${category} (${items.length})`, ``);
    for (const item of items) {
      const details = [
        `old ${item.oldStatus}`,
        `new ${item.newStatus}`,
        item.similarity !== null ? `sim ${item.similarity.toFixed(2)}` : null,
        item.missingAssets?.length
          ? `missing assets: ${item.missingAssets.slice(0, 3).join(", ")}${item.missingAssets.length > 3 ? "…" : ""}`
          : null,
      ]
        .filter(Boolean)
        .join(", ");
      lines.push(`- \`${item.urlKey}\` — ${details}`);
    }
    lines.push(``);
  }

  return lines.join("\n");
}

export { decodeSegment, extractFlipbookPdfPath, getPathFromUrl, normalizeRoutePath };
