import { readFile, stat } from "node:fs/promises";

import { getDownloadById } from "@/lib/db/queries";
import type { WpDownloadAsset } from "@/lib/wp/types";
import {
  contentDisposition,
  contentTypeForDownload,
  isInlineRequest,
  publicDownloadPath,
} from "./download-response";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function findDownload(id: string): Promise<WpDownloadAsset | null> {
  return getDownloadById(id);
}

async function responseForDownload(
  id: string,
  includeBody: boolean,
  inline: boolean,
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
      "Content-Disposition": contentDisposition(download, inline),
      "Content-Length": String(fileStat.size),
      "Content-Type": contentTypeForDownload(download),
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

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return responseForDownload(decodeURIComponent(id), true, isInlineRequest(request));
}

export async function HEAD(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return responseForDownload(decodeURIComponent(id), false, isInlineRequest(request));
}
