import { NextRequest, NextResponse } from "next/server";
import {
  createFixedWindowLimiter,
  type FixedWindowLimiter,
} from "@/lib/security/rate-limit";
import { isObviousBot, parseAnalyticsEvent } from "@/lib/analytics/event-contract";
import { anonymousHashes, storeAnalyticsEvent } from "@/lib/analytics/store";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 4096;
const globalRoute = globalThis as unknown as { analyticsLimiter?: FixedWindowLimiter };

function limiter(): FixedWindowLimiter {
  if (!globalRoute.analyticsLimiter)
    globalRoute.analyticsLimiter = createFixedWindowLimiter({
      limit: 120,
      windowMs: 60_000,
      maxKeys: 20_000,
    });
  return globalRoute.analyticsLimiter;
}

function first(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

function requestIp(request: NextRequest): string | null {
  return (
    first(request.headers.get("cf-connecting-ip")) ||
    first(request.headers.get("x-forwarded-for")) ||
    first(request.headers.get("x-real-ip"))
  );
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginAnalyticsRequest(request))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES)
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const userAgent = request.headers.get("user-agent") || "";
  if (isObviousBot(userAgent))
    return NextResponse.json({ accepted: false, reason: "bot" }, { status: 202 });
  let text: string;
  try {
    text = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES)
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const event = parseAnalyticsEvent(raw);
  if (!event) return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  const ip = requestIp(request);
  const key = anonymousHashes(ip, event.sessionId).visitorHash ?? "unknown";
  if (!limiter().allow(key))
    return NextResponse.json(
      { accepted: false, reason: "rate_limited" },
      { status: 202 },
    );
  try {
    const inserted = await storeAnalyticsEvent({
      event,
      ip,
      userAgent,
      referrer: request.headers.get("referer"),
    });
    return NextResponse.json({ accepted: inserted }, { status: 202 });
  } catch (error) {
    console.error("analytics event storage failed", error);
    return NextResponse.json({ accepted: false }, { status: 202 });
  }
}
