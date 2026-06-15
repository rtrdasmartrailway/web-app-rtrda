import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/session";
import { insertMedia } from "@/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function safeName(name: string): string {
  const ext = path.extname(name).toLowerCase().slice(0, 12);
  const base = path
    .basename(name, path.extname(name))
    .replace(/[^a-zA-Z0-9ก-๙._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${Date.now()}-${base || "file"}${ext}`;
}

export async function POST(request: NextRequest) {
  // Any signed-in user with a role may upload. Authorization for the content
  // mutation itself is enforced separately in the server actions.
  const user = await getCurrentUser();
  if (!user || user.role === "none") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 413 });
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 415 });
  }

  const filename = safeName(file.name || "upload");
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));

  const altText = String(form.get("alt") ?? "");
  const row = await insertMedia({
    filename: file.name || filename,
    filePath: `/uploads/${filename}`,
    mimeType: file.type || "",
    sizeBytes: file.size,
    altText,
  });

  return NextResponse.json({
    id: row.id,
    filePath: row.filePath,
    mimeType: row.mimeType,
    filename: row.filename,
  });
}
