import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { getDownloadById } from "@/db/queries";
import type { WpDownloadAsset } from "@/lib/wp/types";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function publicDownloadPath(download: WpDownloadAsset): string | null {
  if (!download.localPath.startsWith("/sdc-downloads/")) {
    return null;
  }

  const fileName = path.basename(download.localPath);
  if (!fileName) {
    return null;
  }

  const downloadRoot = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "public",
    "sdc-downloads",
  );
  const resolved = path.join(downloadRoot, fileName);

  return resolved.startsWith(downloadRoot) ? resolved : null;
}

function contentDisposition(download: WpDownloadAsset): string {
  const extension = path.extname(download.localPath);
  const fallback = `${download.id}${extension}`.replace(/"/g, "");
  const encodedName = encodeURIComponent(download.fileName || fallback);

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodedName}`;
}

async function findDownload(id: string): Promise<WpDownloadAsset | null> {
  return getDownloadById(id);
}

async function responseForDownload(
  id: string,
  includeBody: boolean,
): Promise<Response> {
  const download = await findDownload(id);
  if (!download) {
    return new Response("Not found", { status: 404 });
  }

  const filePath = publicDownloadPath(download);
  if (!filePath) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const fileStat = await stat(/*turbopackIgnore: true*/ filePath);
    const headers = new Headers({
      "Cache-Control": "no-store",
      "Content-Disposition": contentDisposition(download),
      "Content-Length": String(fileStat.size),
      "Content-Type": download.mimeType || "application/octet-stream",
    });

    if (!includeBody) {
      return new Response(null, { headers });
    }

    const file = await readFile(/*turbopackIgnore: true*/ filePath);
    return new Response(new Uint8Array(file), { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return responseForDownload(decodeURIComponent(id), true);
}

export async function HEAD(_request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return responseForDownload(decodeURIComponent(id), false);
}
