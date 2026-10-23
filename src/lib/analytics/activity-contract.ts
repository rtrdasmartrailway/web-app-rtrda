import { normalizeAnalyticsPath } from "./event-contract";

export const ACTIVITY_TYPES = [
  "page_request",
  "page_view",
  "link_click",
  "download_click",
  "download_response",
  "redirect_response",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export const SESSION_COOKIE = "rtrda_activity_session";
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const DOCUMENT_EXTENSION = /\.(pdf|docx?|xlsx?|pptx?|csv|zip|rar|7z|txt)$/i;

export function activityPath(value: unknown): string | null {
  const path = normalizeAnalyticsPath(value)?.split(/[?#]/, 1)[0];
  if (!path || path.startsWith("//") || path.includes("\\")) return null;
  if (path.split("/").some((part) => part === "." || part === "..")) return null;
  return path
    .normalize("NFC")
    .split("/")
    .map((part) =>
      /@/.test(part) ||
      /(?:token|password|secret|session|access)=/i.test(part) ||
      UUID.test(part) ||
      /^[a-zA-Z0-9_-]{48,}$/.test(part)
        ? "[redacted]"
        : part,
    )
    .join("/");
}

export function publicActivityPath(path: string): boolean {
  return ![
    "/api",
    "/_next",
    "/rtrdaintranet",
    "/pr-center-internal",
    "/logged-files-internal",
    "/healthz",
    "/auth",
  ].some((base) => path === base || path.startsWith(`${base}/`));
}

export function isPublicDocumentPath(path: string): boolean {
  if (!DOCUMENT_EXTENSION.test(path)) return false;
  return (
    ["/wp-content/uploads/", "/sdc-downloads/", "/risk-reports/"].some((base) =>
      path.startsWith(base),
    ) || path.slice(1).indexOf("/") === -1
  );
}

export function isPageRequest(path: string, headers: Headers): boolean {
  return (
    publicActivityPath(path) &&
    !/\.[a-z0-9]{1,8}$/i.test(path) &&
    !path.startsWith("/sdc_download/") &&
    !path.startsWith("/documents/") &&
    !path.startsWith("/r/") &&
    headers.get("rsc") !== "1" &&
    headers.get("next-router-prefetch") !== "1" &&
    headers.get("purpose") !== "prefetch"
  );
}

/** Calendar subtraction with month-end clamping in Asia/Bangkok (UTC+7, no DST). */
export function retentionCutoff(now: Date): Date {
  const shifted = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const day = shifted.getUTCDate();
  shifted.setUTCDate(1);
  shifted.setUTCMonth(shifted.getUTCMonth() - 3);
  const last = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0),
  ).getUTCDate();
  shifted.setUTCDate(Math.min(day, last));
  return new Date(shifted.getTime() - 7 * 60 * 60 * 1000);
}

export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[\s]*[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
