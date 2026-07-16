import { load } from "cheerio";
import type { WpDownloadAsset } from "./types";
import { getRtrdaPathFromUrl, normalizeRoutePath } from "./url";

export type PdfReaderTargetKind = "download" | "upload" | "flipbook";

export interface PdfReaderLink {
  href: string;
  text: string;
  kind: PdfReaderTargetKind;
}

export interface PdfReaderTarget {
  sourceHref: string;
  inlineHref: string;
  downloadHref: string;
  title: string;
  kind: PdfReaderTargetKind;
}

interface PdfReaderResolvers {
  resolveDownload: (id: string) => Promise<WpDownloadAsset | null>;
  resolveFlipbookPdf: (path: string) => Promise<ResolvedFlipbookPdf | null>;
}

const downloadPathPattern = /^\/(?:en\/)?sdc_download\/([^/]+)\/?$/;
const flipbookPathPattern = /^\/(?:en\/)?3d-flip-book\/[^/]+\/?$/;

type ResolvedFlipbookPdf =
  | string
  | {
      pdfPath: string;
      title?: string;
    };

function linkText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function hasPdfExtension(value: string): boolean {
  return /\.pdf$/i.test(normalizeRoutePath(value));
}

function normalizedInternalPath(value: string): string | null {
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

function classifyReaderLink(value: string): {
  href: string;
  kind: PdfReaderTargetKind;
} | null {
  const path = normalizedInternalPath(value);
  if (!path) {
    return null;
  }

  const downloadId = downloadIdFromPath(path);
  if (downloadId) {
    return { href: canonicalDownloadHref(downloadId), kind: "download" };
  }

  if (path.startsWith("/wp-content/uploads/") && hasPdfExtension(path)) {
    return { href: path, kind: "upload" };
  }

  if (flipbookPathPattern.test(path)) {
    return { href: path, kind: "flipbook" };
  }

  return null;
}

function isPdfDownload(download: WpDownloadAsset): boolean {
  return (
    download.mimeType === "application/pdf" ||
    hasPdfExtension(download.localPath) ||
    hasPdfExtension(download.fileName)
  );
}

function downloadTitle(download: WpDownloadAsset, fallback: string): string {
  const rawTitle = linkText(download.title);
  if (rawTitle && !/^\d+\s+downloads?$/i.test(rawTitle)) {
    return rawTitle;
  }

  return linkText(download.fileName) || fallback || download.id;
}

function fallbackPdfTitle(path: string, fallback: string): string {
  const fileName = path.split("/").pop();
  if (!fileName) {
    return fallback || "PDF";
  }

  try {
    return decodeURIComponent(fileName);
  } catch {
    return fileName || fallback || "PDF";
  }
}

export function extractPdfReaderLinks(html: string): PdfReaderLink[] {
  const $ = load(html);
  const links: PdfReaderLink[] = [];
  const seen = new Set<string>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) {
      return;
    }

    const classified = classifyReaderLink(href);
    if (!classified || seen.has(classified.href)) {
      return;
    }

    seen.add(classified.href);
    links.push({
      href: classified.href,
      text: linkText($(element).text()),
      kind: classified.kind,
    });
  });

  return links;
}

export function extractIframePdfSource(html: string): string | null {
  const $ = load(html);
  const sources = [
    ...$("iframe[src]")
      .map((_, element) => $(element).attr("src") ?? "")
      .get(),
    ...$("a[href]")
      .map((_, element) => $(element).attr("href") ?? "")
      .get(),
  ];

  for (const source of sources) {
    const path = normalizedInternalPath(source);
    if (path && path.startsWith("/wp-content/uploads/") && hasPdfExtension(path)) {
      return path;
    }
  }

  return null;
}

export async function buildPdfReaderTargets(
  html: string,
  resolvers: PdfReaderResolvers,
): Promise<PdfReaderTarget[]> {
  const links = extractPdfReaderLinks(html);
  const targets: PdfReaderTarget[] = [];

  for (const link of links) {
    if (link.kind === "download") {
      const id = downloadIdFromPath(link.href);
      if (!id) {
        continue;
      }

      const download = await resolvers.resolveDownload(id);
      if (!download || !isPdfDownload(download)) {
        continue;
      }

      const downloadHref = canonicalDownloadHref(id);
      targets.push({
        sourceHref: downloadHref,
        inlineHref: `${downloadHref}?inline=1`,
        downloadHref,
        title: downloadTitle(download, link.text),
        kind: "download",
      });
      continue;
    }

    if (link.kind === "upload") {
      targets.push({
        sourceHref: link.href,
        inlineHref: `${link.href}?inline=1`,
        downloadHref: link.href,
        title: link.text || fallbackPdfTitle(link.href, "PDF"),
        kind: "upload",
      });
      continue;
    }

    const resolvedFlipbook = await resolvers.resolveFlipbookPdf(link.href);
    const pdfPath =
      typeof resolvedFlipbook === "string" ? resolvedFlipbook : resolvedFlipbook?.pdfPath;
    const flipbookTitle =
      typeof resolvedFlipbook === "object" && resolvedFlipbook !== null
        ? resolvedFlipbook.title
        : "";
    if (!pdfPath || !hasPdfExtension(pdfPath)) {
      continue;
    }

    targets.push({
      sourceHref: link.href,
      inlineHref: `${pdfPath}?inline=1`,
      downloadHref: pdfPath,
      title: flipbookTitle || link.text || fallbackPdfTitle(pdfPath, "PDF"),
      kind: "flipbook",
    });
  }

  return targets;
}
