import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(projectRoot, "src/data/wp-content.json");
const publicRoot = path.join(projectRoot, "public");
const uploadRoot = path.join(publicRoot, "wp-content/uploads");

const SOURCE_ORIGIN = "https://www.rtrda.or.th";
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

const uploadUrlPattern =
  /https?:\/\/www\.rtrda\.or\.th\/wp-content\/uploads\/[^\s"'<>)]*/gi;

function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function normalizeRoutePath(value) {
  const trimmed = String(value ?? "").trim();
  const withoutHash = trimmed.split("#")[0] ?? "";
  const withoutSearch = withoutHash.split("?")[0] ?? "";
  const withLeadingSlash = withoutSearch.startsWith("/")
    ? withoutSearch
    : `/${withoutSearch}`;
  const segments = withLeadingSlash
    .split("/")
    .filter(Boolean)
    .map(decodeSegment);
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

function getPathFromUrl(value) {
  if (value.startsWith("/") && !value.startsWith("//")) {
    return normalizeRoutePath(value);
  }

  try {
    const parsed = new URL(value);
    if (!["www.rtrda.or.th", "rtrda.or.th"].includes(parsed.hostname)) {
      return null;
    }
    return normalizeRoutePath(parsed.pathname);
  } catch {
    return null;
  }
}

function rewriteUrl(value) {
  return getPathFromUrl(value) ?? value;
}

function rewriteSrcSet(value) {
  return value
    .split(",")
    .map((part) => {
      const [url, ...descriptor] = part.trim().split(/\s+/);
      return [rewriteUrl(url), ...descriptor].filter(Boolean).join(" ");
    })
    .join(", ");
}

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

function extractUploadUrls(html) {
  return Array.from(new Set(String(html ?? "").match(uploadUrlPattern) ?? []));
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

function shouldIgnoreRoute(pathname) {
  return (
    pathname.startsWith("/wp-content/uploads/") ||
    pathname.startsWith("/cdn-cgi/") ||
    pathname.startsWith("/sdc_download/") ||
    pathname.startsWith("/en/sdc_download/") ||
    pathname.startsWith("/wp-json") ||
    pathname.startsWith("/en/wp-json") ||
    pathname.startsWith("/wp-admin") ||
    pathname.startsWith("/wp-login") ||
    pathname.includes("/feed") ||
    pathname.endsWith(".xml")
  );
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

function createPageRecords(items, language) {
  const pathById = new Map(
    items.map((item) => [item.id, getPathFromUrl(item.link) ?? "/"]),
  );

  return items.map((item) => ({
    id: `${language}-page-${item.id}`,
    wpId: item.id,
    language,
    kind: "page",
    path: getPathFromUrl(item.link) ?? "/",
    sourceUrl: item.link,
    title: htmlToText(item.title?.rendered),
    excerpt: stripHtml(item.excerpt?.rendered),
    contentHtml: sanitizeAndRewrite(item.content?.rendered),
    modified: item.modified,
    date: item.date,
    parentPath: item.parent ? pathById.get(item.parent) ?? null : null,
    categoryIds: [],
    featuredMediaId: item.featured_media || null,
  }));
}

function createPostRecords(items, language) {
  return items.map((item) => ({
    id: `${language}-post-${item.id}`,
    wpId: item.id,
    language,
    kind: "post",
    path: getPathFromUrl(item.link) ?? `/${item.slug}`,
    sourceUrl: item.link,
    title: htmlToText(item.title?.rendered),
    excerpt: stripHtml(item.excerpt?.rendered),
    contentHtml: sanitizeAndRewrite(item.content?.rendered),
    modified: item.modified,
    date: item.date,
    parentPath: null,
    categoryIds: item.categories ?? [],
    featuredMediaId: item.featured_media || null,
  }));
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

function extractLinksFromRecords(records) {
  const paths = new Set();
  const uploadUrls = new Set();

  for (const record of records) {
    for (const url of extractUploadUrls(record.contentHtml)) {
      uploadUrls.add(url);
    }

    const $ = cheerio.load(record.contentHtml);
    $("[href],[src]").each((_, element) => {
      const href = $(element).attr("href") ?? $(element).attr("src");
      if (!href) return;
      const routePath = getPathFromUrl(href);
      if (!routePath || shouldIgnoreRoute(routePath)) return;
      paths.add(routePath);
    });
  }

  return { paths: Array.from(paths), uploadUrls: Array.from(uploadUrls) };
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

function assertMinimum(name, actual, expected) {
  if (actual < expected) {
    throw new Error(`Expected at least ${expected} ${name}, got ${actual}`);
  }
}

async function main() {
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await mkdir(uploadRoot, { recursive: true });

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

  const records = [
    ...createPageRecords(thPages.items, "th"),
    ...createPageRecords(enPages.items, "en"),
    ...createPostRecords(thPosts.items, "th"),
    ...createPostRecords(enPosts.items, "en"),
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
  const fallbackCandidates = discovered.paths.filter(
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
  records.push(...fallbackRecords.filter(Boolean));

  const mediaAssets = createMediaAssets(media.items);
  const uploadUrls = new Set(discovered.uploadUrls);
  for (const item of media.items) {
    for (const url of mediaUrlsFromItem(item)) {
      uploadUrls.add(url);
    }
  }

  console.log(`Mirroring ${uploadUrls.size} upload assets...`);
  const mirrored = await withConcurrency(Array.from(uploadUrls), 8, async (url) => {
    try {
      return await mirrorAsset(url);
    } catch (error) {
      console.warn(`Failed to mirror ${url}: ${error.message}`);
      return null;
    }
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
    },
    records: records
      .filter((record) => record.path)
      .sort((a, b) => a.path.localeCompare(b.path, "th")),
    categories,
    media: mediaAssets,
  };

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `Wrote ${manifest.records.length} routes, ${manifest.media.length} media records, ${mirrored.filter(Boolean).length} mirrored assets.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
