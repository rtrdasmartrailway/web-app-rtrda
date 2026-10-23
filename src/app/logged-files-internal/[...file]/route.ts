import { servePublicDocument } from "@/lib/analytics/public-file";
import { logActivityLater } from "@/lib/analytics/activity-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ file: string[] }> };
export async function GET(request: Request, context: Context) {
  const { file } = await context.params;
  const path = `/${file.join("/")}`;
  const response = await servePublicDocument(request, path);
  logActivityLater(request, {
    eventType: "download_response",
    path,
    targetPath: path,
    channel: "server",
    method: request.method,
    status: response.status,
    outcome: response.ok
      ? "response_prepared_not_confirmed_received"
      : "response_rejected",
    bytes:
      request.method === "HEAD"
        ? 0
        : response.ok
          ? Number(response.headers.get("content-length"))
          : null,
  });
  return response;
}
export const HEAD = GET;
