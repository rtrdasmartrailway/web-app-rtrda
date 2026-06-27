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

const STATIC_DOWNLOAD_OVERRIDES: Record<string, WpDownloadAsset> = {
  "ita2569-o9-03": {
    id: "ita2569-o9-03",
    sourceUrl: "",
    localPath: "/sdc-downloads/ita2569-o9-03.png",
    fileName: "คู่มือการขอเข้าศึกษาดูงานสถาบันฯ.png",
    mimeType: "image/png",
    sizeBytes: 5_198_518,
    title: "คู่มือการขอเข้าศึกษาดูงานสถาบันฯ",
    group: "ita2569",
    sourcePages: ["th-page-4837"],
  },
  "ita2569-o20-01": {
    id: "ita2569-o20-01",
    sourceUrl: "",
    localPath: "/sdc-downloads/ita2569-o20-01.pdf",
    fileName: "หนังสือประกาศเจตนารมณ์ No Gift Policy ฉบับภาษาไทย.pdf",
    mimeType: "application/pdf",
    sizeBytes: 532_412,
    title: "หนังสือประกาศเจตนารมณ์ No Gift Policy ฉบับภาษาไทย",
    group: "ita2569",
    sourcePages: ["th-page-4837"],
  },
  "ita2569-o20-02": {
    id: "ita2569-o20-02",
    sourceUrl: "",
    localPath: "/sdc-downloads/ita2569-o20-02.pdf",
    fileName: "รายงานผลการดำเนินงานตามนโยบาย No Gift Policy 2568.pdf",
    mimeType: "application/pdf",
    sizeBytes: 3_295_473,
    title: "รายงานผลการดำเนินงานตามนโยบาย No Gift Policy 2568",
    group: "ita2569",
    sourcePages: ["th-page-4837"],
  },
  "ita2569-o20-03": {
    id: "ita2569-o20-03",
    sourceUrl: "",
    localPath: "/sdc-downloads/ita2569-o20-03.jpg",
    fileName: "หลักเกณฑ์การรับทรัพย์สิน มาตรา 128.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 974_352,
    title: "หลักเกณฑ์การรับทรัพย์สิน มาตรา 128",
    group: "ita2569",
    sourcePages: ["th-page-4837"],
  },
  "ita2569-o22-01": {
    id: "ita2569-o22-01",
    sourceUrl: "",
    localPath: "/sdc-downloads/ita2569-o22-01.pdf",
    fileName: "ด้านที่ 2 .รายงานผลด้านการใช้อำนาจตำแหน่งห.pdf",
    mimeType: "application/pdf",
    sizeBytes: 148_833,
    title: "ด้านที่ 2 .รายงานผลด้านการใช้อำนาจตำแหน่งห",
    group: "ita2569",
    sourcePages: ["th-page-4837"],
  },
  "ita2569-o22-02": {
    id: "ita2569-o22-02",
    sourceUrl: "",
    localPath: "/sdc-downloads/ita2569-o22-02.pdf",
    fileName: "ด้านที่ 4.รายงานผล งานบุคคล ปี 2568.pdf",
    mimeType: "application/pdf",
    sizeBytes: 162_706,
    title: "ด้านที่ 4.รายงานผล งานบุคคล ปี 2568",
    group: "ita2569",
    sourcePages: ["th-page-4837"],
  },
};

async function findDownload(id: string): Promise<WpDownloadAsset | null> {
  return (await getDownloadById(id)) ?? STATIC_DOWNLOAD_OVERRIDES[id] ?? null;
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
