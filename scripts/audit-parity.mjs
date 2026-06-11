import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { createFetchTools, describeFetchError } from "./import-wordpress-fetch.mjs";
import {
  CATEGORY,
  classifyComparison,
  extractFlipbookPdfPath,
  extractPageSignals,
  extractRtrdaUrls,
  extractSitemapLocs,
  normalizeTitle,
  normalizeUrlKey,
  renderMarkdownReport,
  shouldAuditPath,
  summarizeResults,
  trigramSimilarity,
} from "./audit-parity-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const POSTS_PER_ARCHIVE_PAGE = 10;
const OLD_FETCH_DELAY_MS = 150;

function parseArgs(argv) {
  const options = {
    oldBase: "https://www.rtrda.or.th",
    newBase: "http://127.0.0.1:3020",
    only: null,
    maxUrls: Infinity,
    reportDir: path.join(projectRoot, "reports"),
    oldConcurrency: 3,
    newConcurrency: 8,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];
    if (arg === "--old-base") options.oldBase = next();
    else if (arg === "--new-base") options.newBase = next();
    else if (arg === "--only") options.only = next();
    else if (arg === "--max-urls") options.maxUrls = Number.parseInt(next(), 10);
    else if (arg === "--report-dir") options.reportDir = path.resolve(next());
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

const { fetchJson, fetchText } = createFetchTools({
  userAgent: "rtrda-parity-audit/1.0",
  onRetry: ({ url, attempt, attempts, error }) => {
    console.warn(
      `Retrying ${url} (${attempt + 1}/${attempts}): ${describeFetchError(error)}`,
    );
  },
});

/** Plain fetch that follows redirects and never throws on HTTP status. */
async function fetchPage(url, { method = "GET" } = {}) {
  try {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      headers: {
        "user-agent": "rtrda-parity-audit/1.0",
        accept: method === "GET" ? "text/html,*/*" : "*/*",
      },
      signal: AbortSignal.timeout(60_000),
    });
    const body = method === "GET" ? await response.text() : "";
    return {
      status: response.status,
      finalUrl: response.url,
      contentType: response.headers.get("content-type") ?? "",
      contentLength: response.headers.get("content-length"),
      body,
    };
  } catch (error) {
    return {
      status: 0,
      finalUrl: url,
      contentType: "",
      contentLength: null,
      body: "",
      error: describeFetchError(error),
    };
  }
}

async function withConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

async function collectSitemapUrls(oldBase) {
  const urls = [];
  try {
    const indexXml = await fetchText(`${oldBase}/sitemap_index.xml`);
    for (const sitemapUrl of extractSitemapLocs(indexXml)) {
      try {
        const xml = await fetchText(sitemapUrl);
        urls.push(...extractSitemapLocs(xml));
      } catch (error) {
        console.warn(`Skipping sitemap ${sitemapUrl}: ${describeFetchError(error)}`);
      }
      await sleep(OLD_FETCH_DELAY_MS);
    }
  } catch (error) {
    console.warn(`Sitemap index unavailable: ${describeFetchError(error)}`);
  }
  return urls;
}

async function collectRestLinks(oldBase) {
  const urls = [];
  for (const restRoot of [`${oldBase}/wp-json/wp/v2`, `${oldBase}/en/wp-json/wp/v2`]) {
    for (const type of ["pages", "posts"]) {
      for (let page = 1; ; page += 1) {
        const endpoint = `${restRoot}/${type}?_fields=link&per_page=100&page=${page}`;
        let batch;
        try {
          batch = await fetchJson(endpoint);
        } catch (error) {
          if (page === 1) {
            console.warn(`REST unavailable ${endpoint}: ${describeFetchError(error)}`);
          }
          break;
        }
        if (!Array.isArray(batch) || batch.length === 0) {
          break;
        }
        urls.push(...batch.map((item) => item.link).filter(Boolean));
        if (batch.length < 100) {
          break;
        }
        await sleep(OLD_FETCH_DELAY_MS);
      }
    }
  }
  return urls;
}

async function collectManifestUrls() {
  const manifestPath = path.join(projectRoot, "src/data/wp-content.json");
  const urls = [];
  const paginationProbes = [];
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    for (const download of manifest.downloads ?? []) {
      if (download.sourceUrl) {
        urls.push(download.sourceUrl);
      }
    }
    for (const category of manifest.categories ?? []) {
      const pages = Math.ceil((category.count ?? 0) / POSTS_PER_ARCHIVE_PAGE);
      for (let page = 2; page <= pages; page += 1) {
        paginationProbes.push(`${category.path}/page/${page}`);
      }
    }
  } catch (error) {
    console.warn(`Manifest unavailable: ${error.message}`);
  }
  return { urls, paginationProbes };
}

async function buildUrlInventory(options) {
  const [sitemapUrls, restUrls, manifest, pagesMd] = await Promise.all([
    collectSitemapUrls(options.oldBase),
    collectRestLinks(options.oldBase),
    collectManifestUrls(),
    readFile(path.join(projectRoot, "RTRDA_PAGES.md"), "utf8").catch(() => ""),
  ]);

  const searchProbes = ["/?s=ราง", "/en/?s=rail"];

  const candidates = [
    ...sitemapUrls,
    ...restUrls,
    ...manifest.urls,
    ...extractRtrdaUrls(pagesMd),
    ...manifest.paginationProbes,
    ...searchProbes,
  ];

  const inventory = new Map();
  for (const candidate of candidates) {
    const key = normalizeUrlKey(candidate);
    if (!key) continue;
    const pathOnly = key.split("?")[0].replace(/\/$/, "") || "/";
    if (!key.includes("?s=") && !shouldAuditPath(pathOnly)) continue;
    if (pathOnly.endsWith(".pdf") || pathOnly.startsWith("/wp-content/uploads/")) {
      continue;
    }
    if (!inventory.has(key)) {
      inventory.set(key, key);
    }
  }

  let keys = Array.from(inventory.keys()).sort();
  if (options.only) {
    keys = keys.filter((key) => key.includes(options.only));
  }
  if (Number.isFinite(options.maxUrls)) {
    keys = keys.slice(0, options.maxUrls);
  }
  return keys;
}

function urlForBase(base, urlKey) {
  if (urlKey.includes("?s=")) {
    const [pathname, query] = urlKey.split("?");
    const url = new URL(pathname || "/", base);
    url.search = `?${query}`;
    return url.toString();
  }
  return new URL(urlKey, base).toString();
}

function isDownloadKey(urlKey) {
  return urlKey.includes("/sdc_download/");
}

async function auditUrl(urlKey, options, assetCache) {
  const oldUrl = urlForBase(options.oldBase, urlKey);
  const newUrl = urlForBase(options.newBase, urlKey);

  if (isDownloadKey(urlKey)) {
    const [oldRes, newRes] = await Promise.all([
      fetchPage(oldUrl, { method: "HEAD" }),
      fetchPage(newUrl, { method: "HEAD" }),
    ]);
    const ok =
      oldRes.status >= 200 &&
      oldRes.status < 400 &&
      newRes.status >= 200 &&
      newRes.status < 400;
    const oldSideBroken = oldRes.status < 200 || oldRes.status >= 400;
    return {
      urlKey,
      oldStatus: oldRes.status,
      newStatus: newRes.status,
      similarity: null,
      titleSimilarity: null,
      missingAssets: [],
      category: ok
        ? CATEGORY.PASS
        : oldSideBroken
          ? CATEGORY.OLD_SIDE_ERROR
          : CATEGORY.STATUS_MISMATCH,
      level: ok ? "pass" : oldSideBroken ? "warn" : "fail",
    };
  }

  const oldRes = await fetchPage(oldUrl);
  await sleep(OLD_FETCH_DELAY_MS);
  const newRes = await fetchPage(newUrl);

  const oldSignals = extractPageSignals(oldRes.body, "old");
  const newSignals = extractPageSignals(newRes.body, "new");
  const bothOk = oldRes.status === 200 && newRes.status === 200;

  // Old flip-book pages render a JS viewer with no extractable text; parity
  // means the new page gives access to the same source PDF.
  if (/^\/(?:en\/)?3d-flip-book\//.test(urlKey)) {
    const pdfPath = extractFlipbookPdfPath(oldRes.body);
    const titleSimilarity = bothOk
      ? trigramSimilarity(normalizeTitle(oldSignals.title), normalizeTitle(newSignals.title))
      : null;
    let flipbookOk = bothOk;
    const missingAssets = [];
    if (bothOk && pdfPath) {
      if (!assetCache.has(pdfPath)) {
        const assetRes = await fetchPage(new URL(pdfPath, options.newBase).toString(), {
          method: "HEAD",
        });
        assetCache.set(pdfPath, assetRes.status >= 200 && assetRes.status < 400);
      }
      const pdfAvailable = assetCache.get(pdfPath);
      const pdfReferenced = newRes.body.includes(
        pdfPath.split("/").pop().replace(/"/g, ""),
      );
      if (!pdfAvailable || !pdfReferenced) {
        flipbookOk = false;
        missingAssets.push(pdfPath);
      }
    }
    const oldSideBroken = oldRes.status < 200 || oldRes.status >= 400;
    return {
      urlKey,
      oldStatus: oldRes.status,
      newStatus: newRes.status,
      similarity: null,
      titleSimilarity,
      oldTitle: oldSignals.title,
      newTitle: newSignals.title,
      missingAssets,
      category: oldSideBroken
        ? CATEGORY.OLD_SIDE_ERROR
        : newRes.status === 404
          ? CATEGORY.MISSING_ROUTE
          : flipbookOk
            ? CATEGORY.PASS
            : CATEGORY.FLIPBOOK_BROKEN,
      level: oldSideBroken ? "warn" : flipbookOk ? "pass" : "fail",
    };
  }

  // When the old page has no recognizable content container, text and asset
  // signals come from the whole <body> (nav, footer, widgets) and are noise.
  const oldSignalsReliable = oldSignals.selector !== null && oldSignals.selector !== "body";

  const similarity =
    bothOk && oldSignalsReliable
      ? trigramSimilarity(oldSignals.text, newSignals.text)
      : null;
  const titleSimilarity = bothOk
    ? trigramSimilarity(normalizeTitle(oldSignals.title), normalizeTitle(newSignals.title))
    : null;

  const missingAssets = [];
  if (newRes.status === 200 && oldSignalsReliable) {
    for (const assetPath of oldSignals.uploadRefs) {
      if (!assetCache.has(assetPath)) {
        const newAsset = await fetchPage(new URL(assetPath, options.newBase).toString(), {
          method: "HEAD",
        });
        let available = newAsset.status >= 200 && newAsset.status < 400;
        if (!available) {
          // A link that is dead on the source site too is source breakage,
          // not a migration gap.
          const oldAsset = await fetchPage(
            new URL(assetPath, options.oldBase).toString(),
            { method: "HEAD" },
          );
          const deadOnSource = oldAsset.status < 200 || oldAsset.status >= 400;
          available = deadOnSource;
        }
        assetCache.set(assetPath, available);
      }
      if (!assetCache.get(assetPath)) {
        missingAssets.push(assetPath);
      }
    }
  }

  let searchOk = null;
  if (urlKey.includes("?s=")) {
    searchOk =
      newRes.status === 200 &&
      newRes.finalUrl.includes("/search") &&
      newSignals.linkCount > 0;
  }

  const { category, level } = classifyComparison({
    urlKey,
    oldStatus: oldRes.status,
    newStatus: newRes.status,
    similarity,
    titleSimilarity,
    missingAssets,
    searchOk,
  });

  return {
    urlKey,
    oldStatus: oldRes.status,
    newStatus: newRes.status,
    oldFinalUrl: oldRes.finalUrl,
    newFinalUrl: newRes.finalUrl,
    similarity,
    titleSimilarity,
    oldTitle: oldSignals.title,
    newTitle: newSignals.title,
    missingAssets,
    category,
    level,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  console.log(`Old base: ${options.oldBase}`);
  console.log(`New base: ${options.newBase}`);

  console.log("Building URL inventory…");
  const urlKeys = await buildUrlInventory(options);
  console.log(`Auditing ${urlKeys.length} URLs…`);

  const assetCache = new Map();
  let completed = 0;
  const results = await withConcurrency(urlKeys, options.oldConcurrency, async (urlKey) => {
    const result = await auditUrl(urlKey, options, assetCache);
    completed += 1;
    if (completed % 25 === 0 || completed === urlKeys.length) {
      console.log(`  ${completed}/${urlKeys.length}`);
    }
    return result;
  });

  const report = {
    generatedAt: new Date().toISOString(),
    oldBase: options.oldBase,
    newBase: options.newBase,
    summary: summarizeResults(results),
    results,
  };

  await mkdir(options.reportDir, { recursive: true });
  await writeFile(
    path.join(options.reportDir, "parity-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await writeFile(
    path.join(options.reportDir, "parity-report.md"),
    `${renderMarkdownReport(report)}\n`,
  );

  console.log(
    `Done: ${report.summary.pass} pass, ${report.summary.warn} warn, ${report.summary.fail} fail`,
  );
  console.log(`Report: ${path.join(options.reportDir, "parity-report.md")}`);

  if (report.summary.fail > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
