import type { NextRequest } from "next/server";

function first(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

export function isSameOriginAnalyticsRequest(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (!origin) return fetchSite === "same-origin";
  try {
    const originHost = new URL(origin).hostname.toLowerCase();
    const requestHost =
      first(request.headers.get("x-forwarded-host")) ||
      first(request.headers.get("host")) ||
      request.nextUrl.hostname;
    return originHost === requestHost.split(":")[0].toLowerCase();
  } catch {
    return false;
  }
}
