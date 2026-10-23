import { NextRequest, NextResponse } from "next/server";
import {
  createFixedWindowLimiter,
  type FixedWindowLimiter,
} from "@/lib/security/rate-limit";
import { parseAnalyticsEvent } from "@/lib/analytics/event-contract";
import { isSameOriginAnalyticsRequest } from "@/lib/analytics/origin-policy";
import {
  activityEnabled,
  activityHashes,
  writeActivity,
} from "@/lib/analytics/activity-store";
import { publicActivityPath, SESSION_COOKIE } from "@/lib/analytics/activity-contract";

export const dynamic = "force-dynamic";
const state = globalThis as unknown as { activityLimiter?: FixedWindowLimiter };
export async function POST(request: NextRequest): Promise<NextResponse> {
  const reply = (body: object, status: number) =>
    NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!isSameOriginAnalyticsRequest(request)) return reply({ error: "Forbidden" }, 403);
  if (!activityEnabled()) return reply({ accepted: false, reason: "disabled" }, 202);
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
    !publicActivityPath(event.path) ||
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
    const inserted = await writeActivity(request.headers, {
      eventId: event.eventId,
      eventType: event.eventType === "download" ? "download_click" : event.eventType,
      path: event.path,
      targetPath: event.targetPath,
      sessionId: event.sessionId,
      source: event.source,
      channel: "client",
      outcome:
        event.eventType === "download"
          ? "click_not_confirmed_download"
          : "browser_observed",
    });
    const response = reply({ accepted: inserted }, 202);
    response.cookies.set(SESSION_COOKIE, event.sessionId, {
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
