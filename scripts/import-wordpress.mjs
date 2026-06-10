import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";
import {
  createDownloadAssetRecord,
  decodeSegment,
  extractDownloadLinks,
  extractLinksFromRecords,
  getPathFromUrl,
  getReferencedUploadPaths,
  normalizeRoutePath,
  rewriteSrcSet,
  rewriteUrl,
  shouldIgnoreRoute,
  SOURCE_ORIGIN,
} from "./import-wordpress-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(projectRoot, "src/data/wp-content.json");
const publicRoot = path.join(projectRoot, "public");
const uploadRoot = path.join(publicRoot, "wp-content/uploads");
const downloadRoot = path.join(publicRoot, "sdc-downloads");

const TH_REST = `${SOURCE_ORIGIN}/wp-json/wp/v2`;
const EN_REST = `${SOURCE_ORIGIN}/en/wp-json/wp/v2`;
const USER_AGENT = "web-app-rtrda-importer/1.0";

const EXPECTED_MINIMUMS = {
  pages: 56,
  posts: 254,
  media: 2603,
  flipbooks: 34,
};

const REST_FIELDS = {
  pages:
    "id,date,modified,slug,link,title,excerpt,content,parent,featured_media,template",
  posts:
    "id,date,modified,slug,link,title,excerpt,content,categories,featured_media",
  categories: "id,count,slug,name,parent,link",
  media: "id,source_url,title,alt_text,media_type,mime_type,media_details",
};

const allowedTags = [
  ...sanitizeHtml.defaults.allowedTags,
  "article",
  "aside",
  "audio",
  "button",
  "details",
  "div",
  "figure",
  "figcaption",
  "h1",
  "h2",
  "iframe",
  "img",
  "nav",
  "section",
  "source",
  "span",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "video",
];

const allowedAttributes = {
  ...sanitizeHtml.defaults.allowedAttributes,
  "*": [
    "aria-*",
    "class",
    "colspan",
    "data-*",
    "height",
    "id",
    "open",
    "rowspan",
    "style",
    "title",
    "width",
  ],
  a: ["aria-*", "class", "href", "name", "rel", "target", "title"],
  img: [
    "alt",
    "class",
    "decoding",
    "height",
    "loading",
    "sizes",
    "src",
    "srcset",
    "title",
    "width",
  ],
  iframe: [
    "allow",
    "allowfullscreen",
    "class",
    "height",
    "loading",
    "referrerpolicy",
    "src",
    "title",
    "width",
  ],
};

function sanitizeAndRewrite(html) {
  return sanitizeHtml(html ?? "", {
    allowedTags,
    allowedAttributes,
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          href: attribs.href ? rewriteUrl(attribs.href) : undefined,
        },
      }),
      img: (_tagName, attribs) => ({
        tagName: "img",
        attribs: {
          ...attribs,
          src: attribs.src ? rewriteUrl(attribs.src) : undefined,
          srcset: attribs.srcset ? rewriteSrcSet(attribs.srcset) : undefined,
        },
      }),
      iframe: (_tagName, attribs) => ({
        tagName: "iframe",
        attribs: {
          ...attribs,
          src: attribs.src ? rewriteUrl(attribs.src) : undefined,
        },
      }),
    },
  });
}

function htmlToText(value) {
  return cheerio.load(`<body>${value ?? ""}</body>`)("body").text().trim();
}

function stripHtml(value) {
  return cheerio.load(`<body>${value ?? ""}</body>`)("body").text().trim();
}

function mediaUrlsFromItem(item) {
  const urls = new Set();
  if (item.source_url) {
    urls.add(item.source_url);
  }

  const sizes = item.media_details?.sizes;
  if (sizes && typeof sizes === "object") {
    for (const size of Object.values(sizes)) {
      if (size?.source_url) {
        urls.add(size.source_url);
      }
    }
  }

  return Array.from(urls);
}

async function fetchWithRetry(url, init = {}, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          "user-agent": USER_AGENT,
          accept: init.accept ?? "*/*",
          ...(init.headers ?? {}),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
  }

  throw lastError;
}

async function fetchJson(url) {
  const response = await fetchWithRetry(url, {
    headers: { accept: "application/json" },
  });
  return response.json();
}

async function fetchText(url) {
  const response = await fetchWithRetry(url, {
    headers: { accept: "text/html,application/xhtml+xml,application/xml" },
  });
  return response.text();
}

async function fetchRestCollection(restRoot, resource, fields) {
  const firstUrl = new URL(`${restRoot}/${resource}`);
  firstUrl.searchParams.set("per_page", "100");
  firstUrl.searchParams.set("page", "1");
  firstUrl.searchParams.set("_fields", fields);

  const firstResponse = await fetchWithRetry(firstUrl.toString(), {
    headers: { accept: "application/json" },
  });
  const total = Number(firstResponse.headers.get("x-wp-total") ?? "0");
  const pages = Number(firstResponse.headers.get("x-wp-totalpages") ?? "1");
  const items = await firstResponse.json();

  for (let page = 2; page <= pages; page += 1) {
    const pageUrl = new URL(firstUrl);
    pageUrl.searchParams.set("page", String(page));
    items.push(...(await fetchJson(pageUrl.toString())));
  }

  return { total, items };
}

async function fetchSitemapUrls(url) {
  const xml = await fetchText(url);
  const $ = cheerio.load(xml, { xmlMode: true });
  return $("loc")
    .map((_, element) => $(element).text().trim())
    .get();
}

async function fetchYoastSitemapRoutes() {
  const sitemapIndex = await fetchSitemapUrls(`${SOURCE_ORIGIN}/sitemap.xml`);
  const routeSitemaps = sitemapIndex.filter(
    (url) =>
      url.includes("/page-sitemap.xml") ||
      url.includes("/post-sitemap.xml") ||
      url.includes("/category-sitemap.xml") ||
      url.includes("/3d-flip-book-sitemap.xml"),
  );

  const urls = new Set();
  const flipbookUrls = [];
  for (const sitemapUrl of routeSitemaps) {
    const sitemapUrls = await fetchSitemapUrls(sitemapUrl);
    for (const sitemapEntry of sitemapUrls) {
      urls.add(sitemapEntry);
      if (sitemapUrl.includes("/3d-flip-book-sitemap.xml")) {
        flipbookUrls.push(sitemapEntry);
      }
    }
  }

  return { urls: Array.from(urls), flipbookUrls };
}

function createNavigationItem($, element) {
  const $item = $(element);
  const $link = $item.children("a").first();
  const rawHref = $link.attr("href") ?? "#";
  const routePath = getPathFromUrl(rawHref);
  const children = $item
    .children("ul.sub-menu")
    .first()
    .children("li")
    .map((_, child) => createNavigationItem($, child))
    .get();

  return {
    label: htmlToText($link.html()),
    href: routePath ?? rawHref,
    path: routePath,
    external: Boolean(rawHref && !routePath && !rawHref.startsWith("#")),
    children,
  };
}

async function fetchPrimaryNavigation(language) {
  const sourceUrl = language === "en" ? `${SOURCE_ORIGIN}/en/` : `${SOURCE_ORIGIN}/`;
  const html = await fetchText(sourceUrl);
  const $ = cheerio.load(html);
  const $menu = $("#menu-primary").first();

  if (!$menu.length) {
    throw new Error(`Could not find #menu-primary in ${sourceUrl}`);
  }

  const items = $menu
    .children("li")
    .map((_, item) => createNavigationItem($, item))
    .get()
    .filter((item) => item.label);

  if (items.length === 0) {
    throw new Error(`Primary navigation in ${sourceUrl} did not contain any items`);
  }

  return items;
}

function collectNavigationInternalPaths(items) {
  const paths = new Set();

  function visit(item) {
    if (item.path && !shouldIgnoreRoute(item.path)) {
      paths.add(item.path);
    }

    for (const child of item.children) {
      visit(child);
    }
  }

  for (const item of items) {
    visit(item);
  }

  return Array.from(paths);
}

function createPageRecords(items, language) {
  const pathById = new Map(
    items.map((item) => [item.id, getPathFromUrl(item.link) ?? "/"]),
  );
  const records = [];
  const downloadLinks = [];

  for (const item of items) {
    const routePath = getPathFromUrl(item.link) ?? "/";
    const rawContent = item.content?.rendered ?? "";

    downloadLinks.push(...extractDownloadLinks(rawContent, routePath));
    records.push({
      id: `${language}-page-${item.id}`,
      wpId: item.id,
      language,
      kind: "page",
      path: routePath,
      sourceUrl: item.link,
      title: htmlToText(item.title?.rendered),
      excerpt: stripHtml(item.excerpt?.rendered),
      contentHtml: sanitizeAndRewrite(rawContent),
      modified: item.modified,
      date: item.date,
      parentPath: item.parent ? pathById.get(item.parent) ?? null : null,
      categoryIds: [],
      featuredMediaId: item.featured_media || null,
    });
  }

  return { records, downloadLinks };
}

function createPostRecords(items, language) {
  const records = [];
  const downloadLinks = [];

  for (const item of items) {
    const routePath = getPathFromUrl(item.link) ?? `/${item.slug}`;
    const rawContent = item.content?.rendered ?? "";

    downloadLinks.push(...extractDownloadLinks(rawContent, routePath));
    records.push({
      id: `${language}-post-${item.id}`,
      wpId: item.id,
      language,
      kind: "post",
      path: routePath,
      sourceUrl: item.link,
      title: htmlToText(item.title?.rendered),
      excerpt: stripHtml(item.excerpt?.rendered),
      contentHtml: sanitizeAndRewrite(rawContent),
      modified: item.modified,
      date: item.date,
      parentPath: null,
      categoryIds: item.categories ?? [],
      featuredMediaId: item.featured_media || null,
    });
  }

  return { records, downloadLinks };
}

function createCategories(items, language) {
  return items.map((item) => ({
    id: item.id,
    language,
    path: getPathFromUrl(item.link) ?? `/category/${item.slug}`,
    slug: decodeSegment(item.slug),
    name: htmlToText(item.name),
    count: item.count,
    parent: item.parent,
  }));
}

function createCategoryRecords(categories, records, language) {
  return categories
    .filter((category) => category.language === language)
    .map((category) => {
    const posts = records
      .filter(
        (record) =>
          record.language === language &&
          record.kind === "post" &&
          record.categoryIds.includes(category.id),
      )
      .slice(0, 60);

    const listHtml = posts
      .map(
        (post) =>
          `<li><a href="${post.path}">${post.title}</a><time datetime="${post.date}">${new Intl.DateTimeFormat(
            language === "th" ? "th-TH" : "en-US",
            { dateStyle: "medium" },
          ).format(new Date(post.date))}</time></li>`,
      )
      .join("");

      return {
        id: `${language}-category-${category.id}`,
        wpId: category.id,
        language,
        kind: "category",
        path: category.path,
        sourceUrl: `${SOURCE_ORIGIN}${category.path}`,
        title: category.name,
        excerpt: "",
        contentHtml: `<ul class="wp-import-list">${listHtml}</ul>`,
        modified: new Date().toISOString(),
        date: new Date().toISOString(),
        parentPath: null,
        categoryIds: [category.id],
        featuredMediaId: null,
      };
    });
}

function createMediaAssets(items) {
  return items.map((item) => {
    const sourceUrl = item.source_url ?? "";
    return {
      id: item.id,
      sourceUrl,
      localPath: getPathFromUrl(sourceUrl) ?? sourceUrl,
      title: htmlToText(item.title?.rendered),
      alt: item.alt_text ?? "",
      width: item.media_details?.width ?? null,
      height: item.media_details?.height ?? null,
      mimeType: item.mime_type ?? "",
    };
  });
}

async function fetchFlipbookRecord(url, index, language) {
  const sourceUrl =
    language === "en"
      ? `${SOURCE_ORIGIN}/en${getPathFromUrl(url)}`
      : url;
  let html;

  try {
    html = await fetchText(sourceUrl);
  } catch {
    html = await fetchText(url);
  }

  const $ = cheerio.load(html);
  const rawTitle =
    $('meta[property="og:title"]').attr("content") ??
    $("title").first().html() ??
    `3D Flip Book ${index + 1}`;
  const title = htmlToText(rawTitle).replace(
    /\s+-\s+สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง.*$/,
    "",
  );
  const pathFromSource = getPathFromUrl(url) ?? `/3d-flip-book/${index + 1}`;
  const routePath = language === "en" ? `/en${pathFromSource}` : pathFromSource;
  const mainHtml = `<div class="wp-flipbook-fallback"><p>${title}</p><p><a href="${sourceUrl}">${
    language === "en" ? "Open original digital publication" : "เปิดเอกสารเผยแพร่ต้นฉบับ"
  }</a></p></div>`;

  return {
    id: `${language}-flipbook-${index}`,
    wpId: `flipbook-${index}`,
    language,
    kind: "flipbook",
    path: routePath,
    sourceUrl,
    title,
    excerpt: "",
    contentHtml: sanitizeAndRewrite(mainHtml),
    modified: new Date().toISOString(),
    date: new Date().toISOString(),
    parentPath: null,
    categoryIds: [],
    featuredMediaId: null,
  };
}

async function fetchFallbackRecord(routePath, index) {
  const sourceUrl = `${SOURCE_ORIGIN}${routePath}`;
  const html = await fetchText(sourceUrl);
  const $ = cheerio.load(html);
  const title = htmlToText(
    $("h1.entry-title").first().html() ??
      $("h1").first().html() ??
      $("title").first().html() ??
      routePath,
  );
  const mainHtml =
    $("main").first().html() ??
    $("article").first().html() ??
    $(".siteContent").first().html() ??
    "";

  return {
    record: {
      id: `fallback-${index}`,
      wpId: `fallback-${index}`,
      language: routePath.startsWith("/en") ? "en" : "th",
      kind: "fallback",
      path: routePath,
      sourceUrl,
      title,
      excerpt: "",
      contentHtml: sanitizeAndRewrite(mainHtml),
      modified: new Date().toISOString(),
      date: new Date().toISOString(),
      parentPath: null,
      categoryIds: [],
      featuredMediaId: null,
    },
    downloadLinks: extractDownloadLinks(mainHtml, routePath),
  };
}

async function withConcurrency(items, limit, worker) {
  const results = [];
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runWorker()),
  );

  return results;
}

async function mirrorAsset(url) {
  const routePath = getPathFromUrl(url);
  if (!routePath?.startsWith("/wp-content/uploads/")) {
    return null;
  }

  const destination = path.join(publicRoot, routePath);
  try {
    await readFile(destination);
    return routePath;
  } catch {
    // Continue and download missing assets.
  }

  const response = await fetchWithRetry(url);
  const bytes = Buffer.from(await response.arrayBuffer());
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
  return routePath;
}

function decodeHeaderFileName(value) {
  try {
    const repaired = Buffer.from(value, "latin1").toString("utf8");
    return repaired.includes("\uFFFD") ? value : repaired;
  } catch {
    return value;
  }
}

function fileNameFromContentDisposition(value) {
  if (!value) {
    return null;
  }

  const encoded = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  }

  const quoted = value.match(/filename="([^"]+)"/i)?.[1];
  if (quoted) {
    return decodeHeaderFileName(quoted);
  }

  const bare = value.match(/filename=([^;]+)/i)?.[1];
  return bare ? decodeHeaderFileName(bare.trim()) : null;
}

function safeDownloadFileName(value, id) {
  const fileName = path.basename(String(value ?? "").replace(/[/\\]/g, "-")).trim();
  return fileName || `${id}.bin`;
}

function contentTypeFromResponse(response) {
  return response.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
}

async function fetchDownloadMetadata(link) {
  const response = await fetchWithRetry(link.sourceUrl, { method: "HEAD" });
  const mimeType = contentTypeFromResponse(response);
  const fileName = safeDownloadFileName(
    fileNameFromContentDisposition(response.headers.get("content-disposition")),
    link.id,
  );
  const contentLength = Number(response.headers.get("content-length") ?? "0");

  return {
    fileName,
    mimeType,
    sizeBytes: Number.isFinite(contentLength) ? contentLength : 0,
  };
}

async function mirrorDownloadAsset(link) {
  let metadata = await fetchDownloadMetadata(link);
  let asset = createDownloadAssetRecord({
    ...link,
    ...metadata,
    sourcePages: link.sourcePages,
  });
  const destination = path.join(publicRoot, asset.localPath);

  try {
    await readFile(destination);
    return asset;
  } catch {
    // Continue and download missing assets.
  }

  const response = await fetchWithRetry(link.sourceUrl);
  const bytes = Buffer.from(await response.arrayBuffer());

  metadata = {
    fileName: safeDownloadFileName(
      fileNameFromContentDisposition(response.headers.get("content-disposition")) ??
        metadata.fileName,
      link.id,
    ),
    mimeType: contentTypeFromResponse(response) || metadata.mimeType,
    sizeBytes: bytes.length,
  };
  asset = createDownloadAssetRecord({
    ...link,
    ...metadata,
    sourcePages: link.sourcePages,
  });

  await mkdir(path.dirname(path.join(publicRoot, asset.localPath)), { recursive: true });
  await writeFile(path.join(publicRoot, asset.localPath), bytes);
  return asset;
}

function mergeDownloadLinks(links) {
  const byId = new Map();

  for (const link of links) {
    const existing = byId.get(link.id);
    if (!existing) {
      byId.set(link.id, {
        id: link.id,
        sourceUrl: link.sourceUrl,
        title: link.title,
        group: link.group,
        sourcePages: [link.sourcePage],
      });
      continue;
    }

    if (!existing.title && link.title) {
      existing.title = link.title;
    }
    if (!existing.group && link.group) {
      existing.group = link.group;
    }
    existing.sourcePages.push(link.sourcePage);
  }

  return Array.from(byId.values()).map((link) => ({
    ...link,
    sourcePages: Array.from(new Set(link.sourcePages)),
  }));
}

async function findMissingReferencedUploadPaths(records) {
  const missing = [];

  for (const routePath of getReferencedUploadPaths(records)) {
    try {
      await readFile(path.join(publicRoot, routePath));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        missing.push(routePath);
        continue;
      }

      throw error;
    }
  }

  return missing;
}

function assertMinimum(name, actual, expected) {
  if (actual < expected) {
    throw new Error(`Expected at least ${expected} ${name}, got ${actual}`);
  }
}

async function main() {
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await mkdir(uploadRoot, { recursive: true });
  await mkdir(downloadRoot, { recursive: true });

  console.log("Fetching WordPress REST collections...");
  const [thPages, enPages, thPosts, enPosts, thCategories, enCategories, media] =
    await Promise.all([
      fetchRestCollection(TH_REST, "pages", REST_FIELDS.pages),
      fetchRestCollection(EN_REST, "pages", REST_FIELDS.pages),
      fetchRestCollection(TH_REST, "posts", REST_FIELDS.posts),
      fetchRestCollection(EN_REST, "posts", REST_FIELDS.posts),
      fetchRestCollection(TH_REST, "categories", REST_FIELDS.categories),
      fetchRestCollection(EN_REST, "categories", REST_FIELDS.categories),
      fetchRestCollection(TH_REST, "media", REST_FIELDS.media),
    ]);

  assertMinimum("pages", thPages.total, EXPECTED_MINIMUMS.pages);
  assertMinimum("posts", thPosts.total, EXPECTED_MINIMUMS.posts);
  assertMinimum("media", media.total, EXPECTED_MINIMUMS.media);

  console.log("Fetching Yoast sitemap routes...");
  const sitemap = await fetchYoastSitemapRoutes();
  assertMinimum("flipbooks", sitemap.flipbookUrls.length, EXPECTED_MINIMUMS.flipbooks);

  console.log("Fetching WordPress primary navigation...");
  const navigation = {
    th: await fetchPrimaryNavigation("th"),
    en: await fetchPrimaryNavigation("en"),
  };

  const thPageImport = createPageRecords(thPages.items, "th");
  const enPageImport = createPageRecords(enPages.items, "en");
  const thPostImport = createPostRecords(thPosts.items, "th");
  const enPostImport = createPostRecords(enPosts.items, "en");
  const records = [
    ...thPageImport.records,
    ...enPageImport.records,
    ...thPostImport.records,
    ...enPostImport.records,
  ];
  const downloadLinks = [
    ...thPageImport.downloadLinks,
    ...enPageImport.downloadLinks,
    ...thPostImport.downloadLinks,
    ...enPostImport.downloadLinks,
  ];
  const categories = [
    ...createCategories(thCategories.items, "th"),
    ...createCategories(enCategories.items, "en"),
  ];
  records.push(...createCategoryRecords(categories, records, "th"));
  records.push(...createCategoryRecords(categories, records, "en"));

  console.log("Fetching 3D flip-book HTML...");
  const flipbookRecords = await withConcurrency(sitemap.flipbookUrls, 4, async (url, index) => {
    const thRecord = await fetchFlipbookRecord(url, index, "th");
    const enRecord = await fetchFlipbookRecord(url, index, "en");
    return [thRecord, enRecord];
  });
  records.push(...flipbookRecords.flat());

  const routePaths = new Set(records.map((record) => normalizeRoutePath(record.path)));
  const missingSitemapRoutes = sitemap.urls
    .map((url) => getPathFromUrl(url))
    .filter((pathname) => pathname && !shouldIgnoreRoute(pathname))
    .filter((pathname) => !routePaths.has(normalizeRoutePath(pathname)));

  if (missingSitemapRoutes.length > 0) {
    throw new Error(
      `Importer did not create routes for sitemap URLs: ${missingSitemapRoutes
        .slice(0, 20)
        .join(", ")}`,
    );
  }

  console.log("Discovering additional internal links...");
  const discovered = extractLinksFromRecords(records);
  const navigationPaths = [
    ...collectNavigationInternalPaths(navigation.th),
    ...collectNavigationInternalPaths(navigation.en),
  ];
  const fallbackCandidates = Array.from(new Set([...discovered.paths, ...navigationPaths])).filter(
    (pathname) => !routePaths.has(normalizeRoutePath(pathname)),
  );
  const fallbackRecords = await withConcurrency(
    fallbackCandidates.slice(0, 80),
    4,
    async (routePath, index) => {
      try {
        return await fetchFallbackRecord(routePath, index);
      } catch (error) {
        console.warn(`Skipped fallback route ${routePath}: ${error.message}`);
        return null;
      }
    },
  );
  const fetchedFallbacks = fallbackRecords.filter(Boolean);
  records.push(...fetchedFallbacks.map((fallback) => fallback.record));
  for (const fallback of fetchedFallbacks) {
    downloadLinks.push(...fallback.downloadLinks);
  }

  const finalRoutePaths = new Set(records.map((record) => normalizeRoutePath(record.path)));
  const missingNavigationRoutes = navigationPaths.filter(
    (pathname) => !finalRoutePaths.has(normalizeRoutePath(pathname)),
  );

  if (missingNavigationRoutes.length > 0) {
    throw new Error(
      `Importer did not create routes for primary menu URLs: ${missingNavigationRoutes
        .slice(0, 20)
        .join(", ")}`,
    );
  }

  const mediaAssets = createMediaAssets(media.items);
  const uploadUrls = new Set(discovered.uploadUrls);
  for (const item of media.items) {
    for (const url of mediaUrlsFromItem(item)) {
      uploadUrls.add(url);
    }
  }

  console.log(`Mirroring ${uploadUrls.size} upload assets...`);
  const failedMirrorPaths = new Set();
  const mirrored = await withConcurrency(Array.from(uploadUrls), 8, async (url) => {
    try {
      return await mirrorAsset(url);
    } catch (error) {
      const routePath = getPathFromUrl(url);
      if (routePath?.startsWith("/wp-content/uploads/")) {
        failedMirrorPaths.add(routePath);
      }
      console.warn(`Failed to mirror ${url}: ${error.message}`);
      return null;
    }
  });

  const missingReferencedUploadPaths = await findMissingReferencedUploadPaths(records);
  const sourceMissingReferencedUploads = missingReferencedUploadPaths.filter((routePath) =>
    failedMirrorPaths.has(routePath),
  );
  const missingReferencedUploads = missingReferencedUploadPaths.filter(
    (routePath) => !failedMirrorPaths.has(routePath),
  );

  if (sourceMissingReferencedUploads.length > 0) {
    console.warn(
      `Source WordPress did not serve ${sourceMissingReferencedUploads.length} referenced upload assets: ${sourceMissingReferencedUploads
        .slice(0, 20)
        .join(", ")}`,
    );
  }

  if (missingReferencedUploads.length > 0) {
    throw new Error(
      `Importer did not mirror referenced upload assets: ${missingReferencedUploads
        .slice(0, 20)
        .join(", ")}`,
    );
  }

  const downloadRequests = mergeDownloadLinks(downloadLinks);
  console.log(`Mirroring ${downloadRequests.length} WordPress download assets...`);
  const downloadAssets = await withConcurrency(downloadRequests, 3, async (link) => {
    const asset = await mirrorDownloadAsset(link);
    return asset;
  });

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: SOURCE_ORIGIN,
    counts: {
      pages: thPages.total,
      posts: thPosts.total,
      media: media.total,
      categories: thCategories.total,
      flipbooks: sitemap.flipbookUrls.length,
      downloads: downloadAssets.length,
    },
    records: records
      .filter((record) => record.path)
      .sort((a, b) => a.path.localeCompare(b.path, "th")),
    categories,
    media: mediaAssets,
    downloads: downloadAssets.sort((a, b) => a.id.localeCompare(b.id, "th")),
    navigation,
  };

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `Wrote ${manifest.records.length} routes, ${manifest.media.length} media records, ${manifest.downloads.length} downloads, ${mirrored.filter(Boolean).length} mirrored assets.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
