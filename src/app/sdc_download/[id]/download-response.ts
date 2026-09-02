import path from "node:path";
import type { WpDownloadAsset } from "@/lib/wp/types";

export function publicDownloadPath(download: WpDownloadAsset): string | null {
  const publicRoot = path.join(/*turbopackIgnore: true*/ process.cwd(), "public");
  const directories = ["/sdc-downloads/", "/wp-content/uploads/"];
  const directory = directories.find((candidate) =>
    download.localPath.startsWith(candidate),
  );
  if (!directory) return null;

  const root = path.resolve(publicRoot, `.${directory}`);
  const relativePath = download.localPath.slice(directory.length);
  const resolved = path.resolve(root, relativePath);

  return resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
}

export function contentDisposition(download: WpDownloadAsset, inline: boolean): string {
  const extension = path.extname(download.localPath);
  const fallback = `${download.id}${extension}`.replace(/"/g, "");
  const encodedName = encodeURIComponent(download.fileName || fallback);
  const disposition = inline ? "inline" : "attachment";

  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodedName}`;
}

export function contentTypeForDownload(download: WpDownloadAsset): string {
  const candidates = [download.localPath, download.fileName];
  if (candidates.some((candidate) => candidate.toLowerCase().endsWith(".pdf"))) {
    return "application/pdf";
  }

  return download.mimeType || "application/octet-stream";
}

export function isInlineRequest(request: Request): boolean {
  return new URL(request.url).searchParams.get("inline") === "1";
}
