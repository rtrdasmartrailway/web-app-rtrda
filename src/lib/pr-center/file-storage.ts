import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, writeFile, unlink, stat } from "node:fs/promises";
import path from "node:path";

const BASE_DIR =
  process.env.PR_CENTER_FILE_DIR ??
  process.env.PRIVATE_DOCUMENTS_DIR ??
  path.join(process.cwd(), "private-documents");

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_MIME_TYPES = new Set([
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // Media
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
  // Archives (rare but sometimes needed)
  "application/zip",
]);

export class FileValidationError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 422,
    readonly code: string = "FILE_VALIDATION_ERROR",
  ) {
    super(message);
  }
}

function computeChecksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function storageKey(): string {
  const id = randomUUID();
  // Spread across 2-level dir tree to avoid huge flat directories.
  return `${id.slice(0, 2)}/${id.slice(2, 4)}/${id}`;
}

function storageDir(orgId: string): string {
  return path.join(BASE_DIR, "pr-center", orgId);
}

export type StoredFile = {
  storageKey: string;
  absolutePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
};

export function validateFileInput(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): void {
  if (!input.fileName || input.fileName.length > 500)
    throw new FileValidationError(
      "File name is required (max 500 characters)",
      422,
      "INVALID_FILE_NAME",
    );
  if (!ALLOWED_MIME_TYPES.has(input.mimeType))
    throw new FileValidationError(
      `File type "${input.mimeType}" is not allowed`,
      415,
      "UNSUPPORTED_FILE_TYPE",
    );
  if (input.sizeBytes < 1 || input.sizeBytes > MAX_FILE_SIZE_BYTES)
    throw new FileValidationError(
      `File size must be between 1 byte and ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`,
      413,
      "FILE_TOO_LARGE",
    );
}

export async function storeFile(
  orgId: string,
  input: {
    fileName: string;
    mimeType: string;
    content: Buffer;
  },
): Promise<StoredFile> {
  validateFileInput({
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.content.length,
  });
  const key = storageKey();
  const dir = storageDir(orgId);
  const filePath = path.join(dir, key);
  await mkdir(path.dirname(filePath), { recursive: true });
  const checksum = computeChecksum(input.content);
  await writeFile(filePath, input.content);
  return {
    storageKey: key,
    absolutePath: filePath,
    fileName: path.basename(input.fileName),
    mimeType: input.mimeType,
    sizeBytes: input.content.length,
    checksum,
  };
}

export async function readFileFromStorage(
  orgId: string,
  storageKey: string,
): Promise<Buffer> {
  const filePath = path.join(storageDir(orgId), storageKey);
  return readFile(filePath);
}

export async function statFile(
  orgId: string,
  storageKey: string,
): Promise<{ size: number } | null> {
  try {
    return await stat(path.join(storageDir(orgId), storageKey));
  } catch {
    return null;
  }
}

export async function removeFileFromStorage(
  orgId: string,
  storageKey: string,
): Promise<boolean> {
  try {
    await unlink(path.join(storageDir(orgId), storageKey));
    return true;
  } catch {
    return false;
  }
}

export { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES };
