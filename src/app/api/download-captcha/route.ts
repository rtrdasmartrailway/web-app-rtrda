import { readFile, stat } from "node:fs/promises";
import {
  getProtectedDocument,
  isProtectedDocumentId,
  protectedDocumentPath,
} from "@/lib/documents/protected-documents";
import {
  issueDownloadCaptcha,
  isProtectedDocumentAction,
  requestIp,
  verifyDownloadCaptcha,
} from "@/lib/security/download-captcha";
import { issueDocumentPreviewToken } from "@/lib/security/document-preview";
import {
  RECAPTCHA_DOWNLOAD_ACTION,
  RECAPTCHA_PREVIEW_ACTION,
  verifyRecaptcha,
} from "@/lib/security/recaptcha";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const documentId = new URL(request.url).searchParams.get("document") ?? "";
  const intent = new URL(request.url).searchParams.get("intent") ?? "download";
  if (!isProtectedDocumentAction(intent)) {
    return Response.json({ error: "ข้อมูล CAPTCHA ไม่ถูกต้อง" }, { status: 400 });
  }
  const challenge = issueDownloadCaptcha(documentId, requestIp(request.headers), intent);
  if (!challenge) {
    return Response.json(
      { error: "ไม่สามารถสร้าง CAPTCHA ได้ในขณะนี้" },
      { status: 429 },
    );
  }
  return Response.json(challenge, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  let payload: {
    answer?: unknown;
    challengeId?: unknown;
    documentId?: unknown;
    intent?: unknown;
    recaptchaToken?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "ข้อมูล CAPTCHA ไม่ถูกต้อง" }, { status: 400 });
  }

  if (typeof payload.documentId !== "string" || typeof payload.intent !== "string") {
    return Response.json({ error: "ข้อมูล CAPTCHA ไม่ถูกต้อง" }, { status: 400 });
  }
  if (
    !isProtectedDocumentAction(payload.intent) ||
    !isProtectedDocumentId(payload.documentId)
  ) {
    return Response.json({ error: "ข้อมูล CAPTCHA ไม่ถูกต้อง" }, { status: 400 });
  }

  if (typeof payload.recaptchaToken === "string") {
    const action =
      payload.intent === "preview" ? RECAPTCHA_PREVIEW_ACTION : RECAPTCHA_DOWNLOAD_ACTION;
    if (!(await verifyRecaptcha(payload.recaptchaToken, action))) {
      return Response.json(
        { fallback: true, error: "ไม่สามารถยืนยัน reCAPTCHA ได้ กรุณาตอบโจทย์แทน" },
        { status: 403 },
      );
    }
  } else {
    if (typeof payload.challengeId !== "string") {
      return Response.json({ error: "ข้อมูล CAPTCHA ไม่ถูกต้อง" }, { status: 400 });
    }
    const verification = verifyDownloadCaptcha(
      payload.challengeId,
      payload.answer,
      payload.documentId,
      requestIp(request.headers),
      payload.intent,
    );
    if (verification !== "success") {
      return Response.json(
        { error: "คำตอบ CAPTCHA ไม่ถูกต้องหรือหมดอายุ" },
        { status: 403 },
      );
    }
  }

  const document = getProtectedDocument(payload.documentId);
  if (!document) return new Response("Not found", { status: 404 });

  if (payload.intent === "preview") {
    return Response.json(
      {
        previewUrl: `/documents/${document.fileName}?access=${issueDocumentPreviewToken(payload.documentId)}`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const filePath = protectedDocumentPath(payload.documentId);
    const [file, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
    return new Response(new Uint8Array(file), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${document.fileName}"`,
        "Content-Length": String(fileStat.size),
        "Content-Type": "application/pdf",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
