import { servePublicDocument } from "@/lib/analytics/public-file";
import { logDownloadResponse } from "@/lib/analytics/activity-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ file: string[] }> };
export async function GET(request: Request, context: Context) {
  const { file } = await context.params;
  const path = `/${file.join("/")}`;
  const response = await servePublicDocument(request, path);
  return logDownloadResponse(request, response, path, path);
}
export const HEAD = GET;
