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
  "ita2569-o8-02": {
    id: "ita2569-o8-02",
    sourceUrl: "",
    localPath: "/sdc-downloads/ita2569-o8-02.pdf",
    fileName: "คู่มือ การจัดการเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ.pdf",
    mimeType: "application/pdf",
    sizeBytes: 296_756,
    title: "คู่มือ การจัดการเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ",
    group: "ita2569",
    sourcePages: ["th-page-4837"],
  },
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
    fileName: 'หนังสือประกาศเจตนารมณ์ No Gift Policy "ฉบับภาษาไทยและภาษาอังกฤษ".pdf',
    mimeType: "application/pdf",
    sizeBytes: 532_412,
    title: 'หนังสือประกาศเจตนารมณ์ No Gift Policy "ฉบับภาษาไทยและภาษาอังกฤษ"',
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
  "ita2569-o21-01": {
    id: "ita2569-o21-01",
    sourceUrl: "",
    localPath: "/sdc-downloads/ita2569-o21-01.pdf",
    fileName:
      "การประเมินความเสี่ยงการทุจริตในหน่วยงานภาครัฐ ประจำปีงบประมาณ พ.ศ. 2569.pdf",
    mimeType: "application/pdf",
    sizeBytes: 4_776_616,
    title: "การประเมินความเสี่ยงการทุจริตในหน่วยงานภาครัฐ ประจำปีงบประมาณ พ.ศ. 2569",
    group: "ita2569",
    sourcePages: ["th-page-4837"],
  },
  "ita2569-o21-02": {
    id: "ita2569-o21-02",
    sourceUrl: "",
    localPath: "/sdc-downloads/ita2569-o21-02.pdf",
    fileName: "ประเมินความเสี่ยงด้านการทุจริตฯ ด้านการเบิกจ่ายเงินงบประมาณ.pdf",
    mimeType: "application/pdf",
    sizeBytes: 298_804,
    title: "ประเมินความเสี่ยงด้านการทุจริตฯ ด้านการเบิกจ่ายเงินงบประมาณ",
    group: "ita2569",
    sourcePages: ["th-page-4837"],
  },
  "ita2569-o22-01": {
    id: "ita2569-o22-01",
    sourceUrl: "",
    localPath: "/sdc-downloads/ita2569-o22-01.pdf",
    fileName: "รายงานผลด้านการใช้อำนาจตำแหน่งหน้าที่.pdf",
    mimeType: "application/pdf",
    sizeBytes: 148_833,
    title: "รายงานผลด้านการใช้อำนาจตำแหน่งหน้าที่",
    group: "ita2569",
    sourcePages: ["th-page-4837"],
  },
  "ita2569-o22-02": {
    id: "ita2569-o22-02",
    sourceUrl: "",
    localPath: "/sdc-downloads/ita2569-o22-02.pdf",
    fileName: "รายงานผลด้านการบริหารงานบุคคล.pdf",
    mimeType: "application/pdf",
    sizeBytes: 162_706,
    title: "รายงานผลด้านการบริหารงานบุคคล",
    group: "ita2569",
    sourcePages: ["th-page-4837"],
  },
  "ita2569-o22-03": {
    id: "ita2569-o22-03",
    sourceUrl: "",
    localPath: "/sdc-downloads/ita2569-o22-03.pdf",
    fileName: "รายงานผลตามแผนบริหารความเสี่ยงการทุจริต ประจำปีงบประมาณ พ.ศ. 2568.pdf",
    mimeType: "application/pdf",
    sizeBytes: 641_603,
    title: "รายงานผลตามแผนบริหารความเสี่ยงการทุจริต ประจำปีงบประมาณ พ.ศ. 2568",
    group: "ita2569",
    sourcePages: ["th-page-4837"],
  },
  "ita2569-o19-08": {
    id: "ita2569-o19-08",
    sourceUrl: "",
    localPath: "/sdc-downloads/ita2569-o19-08.pdf",
    fileName: "รายงานผลการเปิดโอกาสให้บุคคลภายนอกได้มีส่วนร่วม.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1_299_939,
    title:
      "รายงานผลการเปิดโอกาสให้บุคคลภายนอกได้มีส่วนร่วมในการดำเนินงานตามภารกิจปีงบประมาณ 2569",
    group: "ita2569",
    sourcePages: ["th-page-4837"],
  },
  "ita2569-o24-01": {
    id: "ita2569-o24-01",
    sourceUrl: "",
    localPath: "/sdc-downloads/ita2569-o24-01.pdf",
    fileName: "024รายงานผลการดำเนินการป้องกันการทุจริต ปี.pdf",
    mimeType: "application/pdf",
    sizeBytes: 8_088_910,
    title: "024รายงานผลการดำเนินการป้องกันการทุจริต ปี",
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
