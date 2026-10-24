import { readFile, stat } from "node:fs/promises";

import { getDownloadById } from "@/lib/db/queries";
import type { WpDownloadAsset } from "@/lib/wp/types";
import {
  contentDisposition,
  contentTypeForDownload,
  isInlineRequest,
  publicDownloadPath,
} from "./download-response";
import { getStaticDownloadOverride } from "@/lib/wp/static-download-overrides";
import { logDownloadResponse } from "@/lib/analytics/activity-store";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function findDownload(id: string): Promise<WpDownloadAsset | null> {
  return (await getDownloadById(id)) ?? getStaticDownloadOverride(id);
}

async function responseForDownload(
  id: string,
  includeBody: boolean,
  inline: boolean,
  request: Request,
): Promise<Response> {
  let targetPath = `/sdc_download/${id}`;
  const finish = (response: Response) =>
    logDownloadResponse(request, response, targetPath);
  const download = await findDownload(id);
  if (!download) {
    return finish(new Response("Not found", { status: 404 }));
  }

  const filePath = publicDownloadPath(download);
  if (!filePath) {
    return finish(new Response("Not found", { status: 404 }));
  }

  targetPath = download.localPath;
  try {
    const fileStat = await stat(/*turbopackIgnore: true*/ filePath);
    const headers = new Headers({
      "Cache-Control": "no-store",
      "Content-Disposition": contentDisposition(download, inline),
      "Content-Length": String(fileStat.size),
      "Content-Type": contentTypeForDownload(download),
    });

    if (!includeBody) {
      return finish(new Response(null, { headers }));
    }

    const file = await readFile(/*turbopackIgnore: true*/ filePath);
    return finish(new Response(new Uint8Array(file), { headers }));
  } catch {
    return finish(new Response("Not found", { status: 404 }));
  }
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return responseForDownload(
    decodeURIComponent(id),
    true,
    isInlineRequest(request),
    request,
  );
}

export async function HEAD(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return responseForDownload(
    decodeURIComponent(id),
    false,
    isInlineRequest(request),
    request,
  );
}
