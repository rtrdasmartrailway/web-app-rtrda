import { NextRequest, NextResponse } from "next/server";
import {
  createFixedWindowLimiter,
  type FixedWindowLimiter,
} from "@/lib/security/rate-limit";
import { parseAnalyticsEvent } from "@/lib/analytics/event-contract";
import { isSameOriginAnalyticsRequest } from "@/lib/analytics/origin-policy";
import {
  activityEnabled,
  activityHostAllowed,
  activityHashes,
  writeActivity,
} from "@/lib/analytics/activity-store";
import {
  activitySessionId,
  publicActivityPath,
  SESSION_COOKIE,
} from "@/lib/analytics/activity-contract";
import { isObviousBot } from "@/lib/analytics/event-contract";
import { anonymousHashes, storeAnalyticsEvent } from "@/lib/analytics/store";
import { outboundSourceAllowed } from "@/lib/analytics/outbound-form";

export const dynamic = "force-dynamic";
const state = globalThis as unknown as { activityLimiter?: FixedWindowLimiter };
export async function POST(request: NextRequest): Promise<NextResponse> {
  const reply = (body: object, status: number) =>
    NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!isSameOriginAnalyticsRequest(request)) return reply({ error: "Forbidden" }, 403);
  if (!activityEnabled())
    return process.env.ACTIVITY_LOGGING_ENABLED === "true"
      ? reply({ error: "Activity logging unavailable" }, 503)
      : process.env.SITE_ORIGIN === "https://rtrda.or.th" &&
          (process.env.ANALYTICS_ENV === undefined ||
            process.env.ANALYTICS_ENV === "production")
        ? legacyPOST(request)
        : reply({ accepted: false, reason: "disabled" }, 202);
  if (!activityHostAllowed(request.headers)) return reply({ error: "Forbidden" }, 403);
  if (Number(request.headers.get("content-length") || 0) > 4096)
    return reply({ error: "Payload too large" }, 413);
  let text: string;
  try {
    text = await request.text();
  } catch {
    return reply({ error: "Invalid body" }, 400);
  }
  if (Buffer.byteLength(text) > 4096) return reply({ error: "Payload too large" }, 413);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return reply({ error: "Invalid JSON" }, 400);
  }
  if (
    !raw ||
    typeof raw !== "object" ||
    Object.keys(raw).some(
      (key) =>
        !["eventId", "eventType", "path", "targetPath", "sessionId", "source"].includes(
          key,
        ),
    )
  )
    return reply({ error: "Invalid event" }, 400);
  const event = parseAnalyticsEvent(raw);
  if (
    !event ||
    !(event.eventType === "outbound_form_click"
      ? outboundSourceAllowed(event.path)
      : publicActivityPath(event.path)) ||
    (event.targetPath && !publicActivityPath(event.targetPath))
  )
    return reply({ error: "Invalid event" }, 400);
  try {
    state.activityLimiter ??= createFixedWindowLimiter({
      limit: 120,
      windowMs: 60_000,
      maxKeys: 20_000,
    });
    if (
      !state.activityLimiter.allow(
        activityHashes(request.headers).visitorKey || "unknown",
      )
    )
      return reply({ accepted: false, reason: "rate_limited" }, 202);
    const sessionId = activitySessionId(request.headers) || event.sessionId;
    const inserted = await writeActivity(request.headers, {
      eventId: event.eventId,
      eventType: event.eventType === "download" ? "download_click" : event.eventType,
      path: event.path,
      targetPath: event.targetPath,
      sessionId,
      source: event.source,
      channel: "client",
      outcome:
        event.eventType === "download"
          ? "click_not_confirmed_download"
          : event.eventType === "outbound_form_click"
            ? "outbound_click_not_form_submission"
            : "browser_observed",
    });
    const response = reply({ accepted: inserted }, 202);
    response.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 1800,
      path: "/",
    });
    return response;
  } catch {
    console.warn("activity collector temporarily unavailable");
    return reply({ accepted: false, reason: "unavailable" }, 202);
  }
}

/** Unmodified legacy collection semantics while the V2 feature is off. */
const legacyState = globalThis as unknown as { analyticsLimiter?: FixedWindowLimiter };
function first(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}
async function legacyPOST(request: NextRequest): Promise<NextResponse> {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > 4096)
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
  if (Buffer.byteLength(text, "utf8") > 4096)
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const event = parseAnalyticsEvent(raw);
  if (!event) return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  // The legacy table accepts only its original event types. Never persist V2-only form identifiers here.
  if (event.eventType === "outbound_form_click")
    return NextResponse.json(
      { accepted: false, reason: "unsupported_event" },
      { status: 202 },
    );
  const ip =
    first(request.headers.get("cf-connecting-ip")) ||
    first(request.headers.get("x-forwarded-for")) ||
    first(request.headers.get("x-real-ip"));
  const key = anonymousHashes(ip, event.sessionId).visitorHash ?? "unknown";
  legacyState.analyticsLimiter ??= createFixedWindowLimiter({
    limit: 120,
    windowMs: 60_000,
    maxKeys: 20_000,
  });
  if (!legacyState.analyticsLimiter.allow(key))
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
