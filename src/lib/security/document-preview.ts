import { randomUUID } from "node:crypto";
import type { ProtectedDocumentId } from "@/lib/documents/protected-documents";

const PREVIEW_TOKEN_TTL_MS = 5 * 60 * 1000;

const previewTokens = new Map<
  string,
  { documentId: ProtectedDocumentId; expiresAt: number }
>();

function cleanup(now: number) {
  for (const [token, preview] of previewTokens) {
    if (preview.expiresAt <= now) previewTokens.delete(token);
  }
}

export function issueDocumentPreviewToken(
  documentId: ProtectedDocumentId,
  now = Date.now(),
): string {
  cleanup(now);
  const token = randomUUID();
  previewTokens.set(token, { documentId, expiresAt: now + PREVIEW_TOKEN_TTL_MS });
  return token;
}

export function hasDocumentPreviewToken(
  documentId: ProtectedDocumentId,
  token: string | null,
  now = Date.now(),
): boolean {
  cleanup(now);
  return Boolean(token && previewTokens.get(token)?.documentId === documentId);
}
