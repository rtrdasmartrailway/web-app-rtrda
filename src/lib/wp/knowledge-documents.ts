import { load, type Cheerio, type CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import { getRtrdaPathFromUrl, normalizeRoutePath } from "./url";

export interface KnowledgeDocument {
  title: string;
  description: string;
  coverImage: string | null;
  coverAlt: string;
  previewHref: string | null;
  downloadHref: string | null;
  hasUsableTarget: boolean;
  protectedDocumentId?: string;
}

export interface KnowledgeDocumentGroup {
  title: string;
  open: boolean;
  documents: KnowledgeDocument[];
}

export interface KnowledgeDocumentParseOptions {
  validDownloadIds?: Set<string>;
  excludedGroupTitles?: Set<string>;
}

export function isKnowledgeDocumentPath(path: string): boolean {
  const normalized = normalizeRoutePath(path).normalize("NFC");
  return normalized === "/คลังความรู้" || normalized === "/en/คลังความรู้";
}

const downloadPathPattern = /^\/(?:en\/)?sdc_download\/([^/]+)\/?$/;
const flipbookPathPattern = /^\/(?:en\/)?3d-flip-book\/[^/]+\/?$/;
const documentAssetPattern = /\.(?:pdf|xlsx|png|jpe?g|webp|gif|avif)$/i;
const downloadableAssetPattern = /\.(?:pdf|xlsx|png|jpe?g|webp|gif|avif)$/i;

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeInternalPath(value: string): string | null {
  if (!value.trim()) {
    return null;
  }

  const path = getRtrdaPathFromUrl(value);
  return path ? normalizeRoutePath(path).normalize("NFC") : null;
}

function downloadIdFromPath(path: string): string | null {
  const match = path.match(downloadPathPattern);
  return match ? decodeURIComponent(match[1]) : null;
}

function canonicalDownloadHref(id: string): string {
  return `/sdc_download/${encodeURIComponent(id)}`;
}

function normalizeActionHref(
  value: string | undefined,
  options: KnowledgeDocumentParseOptions,
): string | null {
  if (!value) {
    return null;
  }

  const path = normalizeInternalPath(value);
  if (!path) {
    return null;
  }

  const downloadId = downloadIdFromPath(path);
  if (downloadId) {
    if (options.validDownloadIds && !options.validDownloadIds.has(downloadId)) {
      return null;
    }
    return canonicalDownloadHref(downloadId);
  }

  if (flipbookPathPattern.test(path)) {
    return path;
  }

  if (path.startsWith("/wp-content/uploads/") && documentAssetPattern.test(path)) {
    return path;
  }

  return null;
}

function isDownloadableAsset(path: string | null): path is string {
  return Boolean(
    path?.startsWith("/wp-content/uploads/") && downloadableAssetPattern.test(path),
  );
}

function isDownloadRoute(path: string | null): path is string {
  return Boolean(path && downloadPathPattern.test(path));
}

function firstValidHref(
  $: CheerioAPI,
  $links: Cheerio<AnyNode>,
  options: KnowledgeDocumentParseOptions,
): string | null {
  for (const element of $links.toArray()) {
    const href = normalizeActionHref($(element).attr("href"), options);
    if (href) {
      return href;
    }
  }
  return null;
}

function firstImage(
  $: CheerioAPI,
  $column: Cheerio<AnyNode>,
): {
  src: string | null;
  alt: string;
} {
  const image = $column.find("img").first();
  const rawSrc = image.attr("src");
  const src = rawSrc ? (normalizeInternalPath(rawSrc) ?? rawSrc) : null;
  return {
    src,
    alt: compactText(image.attr("alt") ?? ""),
  };
}

function findReadHref(
  $: CheerioAPI,
  $column: Cheerio<AnyNode>,
  options: KnowledgeDocumentParseOptions,
): string | null {
  return firstValidHref(
    $,
    $column
      .find(".detail-btn a[href], .wp-block-button a[href], a[href]")
      .filter((_, element) => {
        const $link = $(element);
        const text = compactText($link.text()).toLowerCase();
        return (
          text.includes("อ่านเพิ่มเติม") ||
          text.includes("read") ||
          $link.closest(".detail-btn").length > 0
        );
      }),
    options,
  );
}

function findDownloadHref(
  $: CheerioAPI,
  $root: Cheerio<AnyNode>,
  options: KnowledgeDocumentParseOptions,
): string | null {
  return firstValidHref(
    $,
    $root.find("a[href]").filter((_, element) => {
      const $link = $(element);
      const text = compactText($link.text()).toLowerCase();
      return (
        $link.hasClass("simple-download-counter-link") ||
        text.includes("ดาวน์โหลด") ||
        text.includes("download")
      );
    }),
    options,
  );
}

function allDownloadHrefs(
  $: CheerioAPI,
  $root: Cheerio<AnyNode>,
  options: KnowledgeDocumentParseOptions,
): string[] {
  const hrefs: string[] = [];
  const seen = new Set<string>();
  $root.find("a[href]").each((_, element) => {
    const href = normalizeActionHref($(element).attr("href"), options);
    if (!href || !isDownloadRoute(href) || seen.has(href)) {
      return;
    }
    seen.add(href);
    hrefs.push(href);
  });
  return hrefs;
}

function descriptionFromColumn(
  $: CheerioAPI,
  $column: Cheerio<AnyNode>,
  title: string,
): string {
  const parts: string[] = [];
  $column.find("p").each((_, element) => {
    const $paragraph = $(element);
    if ($paragraph.hasClass("simple-download-counter")) {
      return;
    }

    const text = compactText($paragraph.text());
    if (
      !text ||
      text === title ||
      text.includes("ดาวน์โหลดไฟล์") ||
      text.toLowerCase().includes("download")
    ) {
      return;
    }
    parts.push(text);
  });
  return parts.join(" ");
}

function buildDocumentFromColumn(
  $: CheerioAPI,
  $column: Cheerio<AnyNode>,
  options: KnowledgeDocumentParseOptions,
): KnowledgeDocument | null {
  const title = compactText($column.find("h1,h2,h3,h4,h5,h6").first().text());
  if (!title) {
    return null;
  }

  const cover = firstImage($, $column);
  const readHref = findReadHref($, $column, options);
  const imageHref = firstValidHref($, $column.find("figure a[href]").first(), options);
  const downloadHref = findDownloadHref($, $column, options);
  const assetFallback = isDownloadableAsset(readHref)
    ? readHref
    : isDownloadableAsset(imageHref)
      ? imageHref
      : null;
  const finalDownloadHref = downloadHref ?? assetFallback;
  const previewHref = readHref ?? imageHref ?? downloadHref;

  return {
    title,
    description: descriptionFromColumn($, $column, title),
    coverImage: cover.src,
    coverAlt: cover.alt,
    previewHref,
    downloadHref: finalDownloadHref,
    hasUsableTarget: Boolean(previewHref || finalDownloadHref),
  };
}

function withOrphanDownload(
  documents: KnowledgeDocument[],
  bodyDownloads: string[],
): KnowledgeDocument[] {
  if (documents.length !== 1 || documents[0].downloadHref) {
    return documents;
  }

  const documentDownloads = new Set(
    documents.flatMap((document) =>
      document.downloadHref && isDownloadRoute(document.downloadHref)
        ? [document.downloadHref]
        : [],
    ),
  );
  const orphanDownloads = bodyDownloads.filter((href) => !documentDownloads.has(href));
  if (orphanDownloads.length !== 1) {
    return documents;
  }

  const [document] = documents;
  const downloadHref = orphanDownloads[0];
  return [
    {
      ...document,
      previewHref: document.previewHref ?? downloadHref,
      downloadHref,
      hasUsableTarget: true,
    },
  ];
}

export function buildKnowledgeDocumentGroups(
  html: string,
  options: KnowledgeDocumentParseOptions = {},
): KnowledgeDocumentGroup[] {
  const $ = load(html);
  const groups: KnowledgeDocumentGroup[] = [];

  $(".lightweight-accordion").each((_, accordion) => {
    const $accordion = $(accordion);
    const $details = $accordion.find("details").first();
    const $body = $accordion.find(".lightweight-accordion-body").first();
    const title = compactText(
      $accordion.find("summary.lightweight-accordion-title").first().text(),
    );
    if (options.excludedGroupTitles?.has(title)) {
      return;
    }
    const bodyDownloads = allDownloadHrefs($, $body, options);
    const documents = $body
      .children(".wp-block-columns")
      .children(".wp-block-column")
      .toArray()
      .map((column) => buildDocumentFromColumn($, $(column), options))
      .filter((document): document is KnowledgeDocument => document !== null);
    const normalizedDocuments = withOrphanDownload(documents, bodyDownloads);

    if (!title || normalizedDocuments.length === 0) {
      return;
    }

    groups.push({
      title,
      open: $details.attr("open") !== undefined,
      documents: normalizedDocuments,
    });
  });

  return groups;
}
