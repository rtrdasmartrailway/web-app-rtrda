import { readFile, stat } from "node:fs/promises";
import {
  getProtectedDocument,
  isProtectedDocumentId,
  protectedDocumentPath,
} from "@/lib/documents/protected-documents";
import { hasDocumentPreviewToken } from "@/lib/security/document-preview";
import { logDownloadResponse } from "@/lib/analytics/activity-store";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ document: string }>;
};

async function documentResponse(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { document } = await context.params;
  const documentId = document.replace(/\.pdf$/, "");
  if (!isProtectedDocumentId(documentId))
    return new Response("Not found", { status: 404 });
  const protectedDocument = getProtectedDocument(documentId);
  if (!protectedDocument) return new Response("Not found", { status: 404 });
  const accessToken = new URL(request.url).searchParams.get("access");
  if (!hasDocumentPreviewToken(documentId, accessToken))
    return new Response("Not found", { status: 404 });

  try {
    const filePath = protectedDocumentPath(documentId);
    const [file, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
    return new Response(new Uint8Array(file), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `inline; filename="${protectedDocument.fileName}"`,
        "Content-Length": String(fileStat.size),
        "Content-Type": "application/pdf",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { document } = await context.params;
  return logDownloadResponse(
    request,
    await documentResponse(request, context),
    `/documents/${document}`,
  );
}
