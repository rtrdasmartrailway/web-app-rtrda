import path from "node:path";
import * as cheerio from "cheerio";

export const SOURCE_ORIGIN = "https://www.rtrda.or.th";

const RTRDA_HOSTS = new Set(["www.rtrda.or.th", "rtrda.or.th"]);
const absoluteUploadUrlPattern =
  /https?:\/\/www\.rtrda\.or\.th\/wp-content\/uploads\/[^\s"'<>)]*/gi;
const downloadRoutePattern = /^\/(?:en\/)?sdc_download\/([^/]+)\/?$/;

const extensionByMimeType = new Map([
  ["application/pdf", ".pdf"],
  ["application/zip", ".zip"],
  ["application/x-zip-compressed", ".zip"],
  ["application/msword", ".doc"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".docx",
  ],
  ["application/vnd.ms-excel", ".xls"],
  [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xlsx",
  ],
  ["application/vnd.ms-powerpoint", ".ppt"],
  [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".pptx",
  ],
]);

export function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function normalizeRoutePath(value) {
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

export function getPathFromUrl(value) {
  if (!value) {
    return null;
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return normalizeRoutePath(value);
  }

  try {
    const parsed = new URL(value);
    if (!RTRDA_HOSTS.has(parsed.hostname.toLowerCase())) {
      return null;
    }
    return normalizeRoutePath(parsed.pathname);
  } catch {
    return null;
  }
}

export function shouldIgnoreRoute(pathname) {
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

export function uploadSourceUrlFromPath(value) {
  const routePath = getPathFromUrl(value);
  if (!routePath?.startsWith("/wp-content/uploads/")) {
    return null;
  }

  return new URL(routePath, SOURCE_ORIGIN).toString();
}

export function getDownloadIdFromUrl(value) {
  const routePath = getPathFromUrl(value);
  const match = routePath?.match(downloadRoutePattern);
  return match?.[1] ?? null;
}

export function downloadSourceUrlFromValue(value) {
  if (!value) {
    return null;
  }

  let parsed;
  try {
    parsed = value.startsWith("/") && !value.startsWith("//")
      ? new URL(value, SOURCE_ORIGIN)
      : new URL(value);
  } catch {
    return null;
  }

  if (!RTRDA_HOSTS.has(parsed.hostname.toLowerCase())) {
    return null;
  }

  const routePath = normalizeRoutePath(parsed.pathname);
  const match = routePath.match(downloadRoutePattern);
  if (!match) {
    return null;
  }

  const sourceUrl = new URL(`/sdc_download/${match[1]}/`, SOURCE_ORIGIN);
  sourceUrl.search = parsed.search;
  return sourceUrl.toString();
}

export function downloadRoutePathFromValue(value) {
  const id = getDownloadIdFromUrl(value);
  return id ? `/sdc_download/${id}` : null;
}

/**
 * Extract the source PDF of a 3D flip-book page. The viewer plugin embeds
 * `window.FB3D_CLIENT_DATA.push('<base64 JSON>')` whose `posts[id].data.guid`
 * is the PDF URL.
 */
export function extractFlipbookPdfPath(html) {
  const match = String(html ?? "").match(
    /FB3D_CLIENT_DATA\.push\('([A-Za-z0-9+/=]+)'\)/,
  );
  if (!match) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(match[1], "base64").toString("utf8"));
    for (const post of Object.values(payload.posts ?? {})) {
      const guid = post?.data?.guid;
      const routePath = guid ? getPathFromUrl(guid) : null;
      if (routePath?.startsWith("/wp-content/uploads/")) {
        return routePath;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function textFrom($, element) {
  return $(element).text().replace(/\s+/g, " ").trim();
}

export function extractDownloadLinks(html, sourcePagePath) {
  const links = [];
  const seen = new Set();
  const $ = cheerio.load(String(html ?? ""));

  $('a[href*="/sdc_download/"], a[href*="sdc_download/"]').each((_, element) => {
    const href = $(element).attr("href");
    const sourceUrl = downloadSourceUrlFromValue(href);
    const id = getDownloadIdFromUrl(href);
    if (!sourceUrl || !id) {
      return;
    }

    const key = `${sourcePagePath}:${id}:${sourceUrl}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    const $column = $(element).closest(".wp-block-column");
    const $accordion = $(element).closest(".lightweight-accordion");
    const title =
      textFrom($, $column.find("h1,h2,h3,h4,h5,h6").first()) ||
      textFrom($, $(element).closest("p").prevAll("h1,h2,h3,h4,h5,h6").first()) ||
      $(element).attr("title") ||
      "";
    const group =
      textFrom($, $accordion.find("summary").first()) ||
      textFrom($, $accordion.children("span").first()) ||
      textFrom($, $accordion.find(".lightweight-accordion-title").first()) ||
      "";

    links.push({
      id,
      sourceUrl,
      title,
      group,
      sourcePage: sourcePagePath,
    });
  });

  return links;
}

function extensionForDownload(fileName, mimeType) {
  const ext = path.extname(String(fileName ?? "").split(/[?#]/)[0]).toLowerCase();
  if (ext) {
    return ext;
  }

  return extensionByMimeType.get(String(mimeType ?? "").toLowerCase()) ?? ".bin";
}

export function createDownloadAssetRecord({
  id,
  sourceUrl,
  fileName,
  mimeType,
  sizeBytes,
  title,
  group,
  sourcePages,
}) {
  const extension = extensionForDownload(fileName, mimeType);

  return {
    id: String(id),
    sourceUrl,
    localPath: `/sdc-downloads/${id}${extension}`,
    fileName,
    mimeType,
    sizeBytes,
    title: title ?? "",
    group: group ?? "",
    sourcePages: Array.from(new Set(sourcePages ?? [])),
  };
}

export function rewriteUrl(value) {
  return downloadRoutePathFromValue(value) ?? getPathFromUrl(value) ?? value;
}

export function rewriteSrcSet(value) {
  return value
    .split(",")
    .map((part) => {
      const [url, ...descriptor] = part.trim().split(/\s+/);
      return [rewriteUrl(url), ...descriptor].filter(Boolean).join(" ");
    })
    .join(", ");
}

function uploadUrlsFromSrcSet(value) {
  return value
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0])
    .map(uploadSourceUrlFromPath)
    .filter(Boolean);
}

export function extractUploadUrls(html) {
  const urls = new Set();
  const rawHtml = String(html ?? "");

  for (const absoluteUrl of rawHtml.match(absoluteUploadUrlPattern) ?? []) {
    const sourceUrl = uploadSourceUrlFromPath(absoluteUrl);
    if (sourceUrl) {
      urls.add(sourceUrl);
    }
  }

  const $ = cheerio.load(rawHtml);
  $("[href],[src],[srcset]").each((_, element) => {
    const href = $(element).attr("href");
    const src = $(element).attr("src");
    const srcset = $(element).attr("srcset");

    for (const value of [href, src]) {
      const sourceUrl = value ? uploadSourceUrlFromPath(value) : null;
      if (sourceUrl) {
        urls.add(sourceUrl);
      }
    }

    if (srcset) {
      for (const sourceUrl of uploadUrlsFromSrcSet(srcset)) {
        urls.add(sourceUrl);
      }
    }
  });

  return Array.from(urls);
}

export function extractLinksFromRecords(records) {
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
      if (!routePath) return;
      if (routePath.startsWith("/wp-content/uploads/")) return;
      if (shouldIgnoreRoute(routePath)) return;
      paths.add(routePath);
    });
  }

  return { paths: Array.from(paths), uploadUrls: Array.from(uploadUrls) };
}

export function getReferencedUploadPaths(records) {
  const paths = new Set();

  for (const record of records) {
    for (const sourceUrl of extractUploadUrls(record.contentHtml)) {
      const routePath = getPathFromUrl(sourceUrl);
      if (routePath?.startsWith("/wp-content/uploads/")) {
        paths.add(routePath);
      }
    }
  }

  return Array.from(paths);
}
