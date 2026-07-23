export const ANALYTICS_EVENT_TYPES = ["page_view", "link_click", "download"] as const;
export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export type AnalyticsEventPayload = {
  eventId: string;
  eventType: AnalyticsEventType;
  path: string;
  targetPath: string | null;
  sessionId: string;
  source: "direct" | "internal" | "external";
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOWNLOAD_PATTERN = /\.(?:pdf|docx?|xlsx?|pptx?|csv|zip|rar|7z|txt)(?:$|\/)/i;
const EXCLUDED_PREFIXES = ["/_next/", "/api/", "/rtrdaintranet", "/healthz"];

export function normalizeAnalyticsPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.length > 1024)
    return null;
  if (value.includes("://") || /[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, "https://analytics.invalid");
    const path = decodeURIComponent(url.pathname).replace(/\/{2,}/g, "/");
    return path.length <= 512 && !/[\u0000-\u001f\u007f]/.test(path) ? path : null;
  } catch {
    return null;
  }
}

export function isTrackablePath(path: string): boolean {
  return !EXCLUDED_PREFIXES.some(
    (prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix),
  );
}

export function classifyTarget(path: string): "download" | "link_click" {
  return path.startsWith("/sdc_download/") || DOWNLOAD_PATTERN.test(path)
    ? "download"
    : "link_click";
}

export function detectAnalyticsDevice(
  userAgent: string,
): "desktop" | "mobile" | "tablet" | "unknown" {
  const ua = userAgent.toLowerCase();
  if (!ua) return "unknown";
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobile|iphone|android/.test(ua)) return "mobile";
  return "desktop";
}

export function isObviousBot(userAgent: string): boolean {
  return /bot|crawler|spider|slurp|headless|lighthouse|facebookexternalhit|preview/i.test(
    userAgent,
  );
}

export function safeReferrerHost(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase().slice(0, 255) || null;
  } catch {
    return null;
  }
}

export function parseAnalyticsEvent(value: unknown): AnalyticsEventPayload | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.eventId !== "string" || !UUID_PATTERN.test(raw.eventId)) return null;
  if (typeof raw.sessionId !== "string" || !UUID_PATTERN.test(raw.sessionId)) return null;
  if (!ANALYTICS_EVENT_TYPES.includes(raw.eventType as AnalyticsEventType)) return null;
  if (!(["direct", "internal", "external"] as const).includes(raw.source as never))
    return null;
  const path = normalizeAnalyticsPath(raw.path);
  if (!path || !isTrackablePath(path)) return null;
  const targetPath =
    raw.targetPath == null ? null : normalizeAnalyticsPath(raw.targetPath);
  if (raw.targetPath != null && (!targetPath || !isTrackablePath(targetPath)))
    return null;
  if (raw.eventType !== "page_view" && !targetPath) return null;
  return {
    eventId: raw.eventId,
    eventType: raw.eventType as AnalyticsEventType,
    path,
    targetPath,
    sessionId: raw.sessionId,
    source: raw.source as AnalyticsEventPayload["source"],
  };
}
