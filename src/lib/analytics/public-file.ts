import path from "node:path";
import { realpath, stat } from "node:fs/promises";
import { createReadStream, type ReadStream } from "node:fs";
import { Readable } from "node:stream";
import { isPublicDocumentPath } from "./activity-contract";

export function byteRange(
  value: string | null,
  size: number,
): { start: number; end: number } | null | "invalid" {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2]) || size === 0) return "invalid";
  const suffix = !match[1];
  const start = suffix ? Math.max(0, size - Number(match[2])) : Number(match[1]);
  const end = suffix
    ? size - 1
    : match[2]
      ? Math.min(size - 1, Number(match[2]))
      : size - 1;
  return Number.isSafeInteger(start) &&
    Number.isSafeInteger(end) &&
    start >= 0 &&
    start < size &&
    end >= start
    ? { start, end }
    : "invalid";
}

export async function servePublicDocument(
  request: Request,
  requestedPath: string,
  root = path.join(process.cwd(), "public"),
): Promise<Response> {
  if (
    !isPublicDocumentPath(requestedPath) ||
    requestedPath.includes("\\") ||
    requestedPath.split("/").some((part) => part === ".." || part === ".")
  )
    return new Response("Not found", { status: 404 });
  try {
    const [realRoot, file] = await Promise.all([
      realpath(root),
      realpath(path.resolve(root, `.${requestedPath}`)),
    ]);
    if (!file.startsWith(`${realRoot}${path.sep}`))
      return new Response("Not found", { status: 404 });
    const info = await stat(file);
    if (!info.isFile()) return new Response("Not found", { status: 404 });
    const range = byteRange(request.headers.get("range"), info.size);
    const headers = new Headers({
      "Cache-Control": "private, no-store",
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy": "frame-ancestors 'self'",
    });
    const mime: Record<string, string> = {
      pdf: "application/pdf",
      csv: "text/csv",
      txt: "text/plain",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      zip: "application/zip",
    };
    headers.set(
      "Content-Type",
      mime[path.extname(file).slice(1).toLowerCase()] || "application/octet-stream",
    );
    headers.set(
      "Content-Disposition",
      `${path.extname(file).toLowerCase() === ".pdf" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(path.basename(file))}`,
    );
    if (range === "invalid") {
      headers.set("Content-Range", `bytes */${info.size}`);
      return new Response(null, { status: 416, headers });
    }
    const start = range?.start ?? 0;
    const end = range?.end ?? info.size - 1;
    headers.set("Content-Length", String(Math.max(0, end - start + 1)));
    if (range) headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
    let stream: ReadStream | null = null;
    if (request.method !== "HEAD" && info.size > 0)
      stream = createReadStream(file, { start, end });
    const body = stream ? (Readable.toWeb(stream) as ReadableStream<Uint8Array>) : null;
    return new Response(body, { status: range ? 206 : 200, headers });
  } catch {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
