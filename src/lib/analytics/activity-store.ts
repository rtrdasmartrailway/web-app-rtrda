import { createHash, createHmac, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { after } from "next/server";
import { detectAnalyticsDevice, isObviousBot } from "./event-contract";
import {
  activityPath,
  activitySessionId,
  SESSION_COOKIE,
  UUID,
  type ActivityType,
} from "./activity-contract";
import { validatedFormTarget } from "./outbound-form";

export function storedFormTarget(value: unknown): string | null {
  const target = validatedFormTarget(value);
  if (!target) return null;
  const kind = target.split("/")[2];
  return `/outbound-form/${kind}/${createHash("sha256").update(target).digest("hex").slice(0, 32)}`;
}

const state = globalThis as unknown as {
  activityPool?: Pool;
  activityCleanupTimer?: ReturnType<typeof setInterval>;
};
export function activityEnabled(): boolean {
  return (
    process.env.ACTIVITY_LOGGING_ENABLED === "true" &&
    process.env.ANALYTICS_ENV === "test" &&
    process.env.SITE_ORIGIN === "https://test.rtrda.or.th"
  );
}
export function activityPool(): Pool {
  return (state.activityPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 4,
    connectionTimeoutMillis: 3000,
    statement_timeout: 5000,
  }));
}
export const RETENTION_SQL = `DELETE FROM web_activity_events_v2 WHERE environment = 'test' AND occurred_at < ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok' - INTERVAL '3 months') AT TIME ZONE 'Asia/Bangkok')`;
export async function cleanupActivityEvents(): Promise<number> {
  if (!activityEnabled() || process.env.ACTIVITY_RETENTION_ENABLED !== "true") return 0;
  return (await activityPool().query(RETENTION_SQL)).rowCount ?? 0;
}
function startCleanup() {
  if (state.activityCleanupTimer || process.env.ACTIVITY_RETENTION_ENABLED !== "true")
    return;
  const clean = () => {
    void cleanupActivityEvents().catch(() =>
      console.warn("activity retention temporarily unavailable"),
    );
  };
  clean();
  state.activityCleanupTimer = setInterval(clean, 60 * 60 * 1000);
  state.activityCleanupTimer.unref();
}
export function activityHashes(
  headers: Headers,
  sessionId?: string | null,
  now = new Date(),
) {
  const salt = process.env.ANALYTICS_HASH_SALT;
  if (!salt) throw new Error("Activity hashing unavailable");
  const hash = (text: string) => createHmac("sha256", salt).update(text).digest("hex");
  const ip = (headers.get("cf-connecting-ip") || headers.get("x-forwarded-for") || "")
    .split(",")[0]
    .trim();
  const day = new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
  const session =
    activitySessionId(headers) || (sessionId && UUID.test(sessionId) ? sessionId : null);
  return {
    visitorKey: ip ? hash(`visitor:${day}:${ip}`) : null,
    sessionKey: session ? hash(`session:${session}`) : null,
  };
}
export type ActivityInput = {
  eventId?: string;
  eventType: ActivityType;
  path: string;
  targetPath?: string | null;
  source?: "direct" | "internal" | "external";
  channel: "client" | "server";
  method?: string;
  status?: number | null;
  outcome: string;
  bytes?: number | null;
  sessionId?: string | null;
};
export async function writeActivity(
  headers: Headers,
  input: ActivityInput,
): Promise<boolean> {
  if (!activityEnabled()) return false;
  const path = activityPath(input.path);
  const target =
    input.eventType === "outbound_form_click"
      ? storedFormTarget(input.targetPath)
      : input.targetPath
        ? activityPath(input.targetPath)
        : null;
  if (!path || (input.targetPath && !target)) return false;
  const keys = activityHashes(headers, input.sessionId);
  const ua = headers.get("user-agent") || "";
  const result = await activityPool().query(
    `INSERT INTO web_activity_events_v2 (event_id,environment,event_type,path,target_path,source,channel,method,status,outcome,response_bytes,device_type,is_bot,visitor_key,session_key) VALUES ($1,'test',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (event_id) DO NOTHING`,
    [
      input.eventId || randomUUID(),
      input.eventType,
      path,
      target,
      input.source || "direct",
      input.channel,
      input.method || null,
      input.status ?? null,
      input.outcome,
      input.bytes ?? null,
      detectAnalyticsDevice(ua),
      isObviousBot(ua),
      keys.visitorKey,
      keys.sessionKey,
    ],
  );
  startCleanup();
  return (result.rowCount ?? 0) > 0;
}
/** Capture safe metadata now; never retain Request objects, bodies, raw headers or query strings. */
export function logActivityLater(request: Request, input: ActivityInput): void {
  if (!activityEnabled()) return;
  const safe = new Headers();
  for (const key of ["cf-connecting-ip", "x-forwarded-for", "user-agent"]) {
    const value = request.headers.get(key);
    if (value) safe.set(key, value);
  }
  const session = request.headers
    .get("cookie")
    ?.split(";")
    .find((part) => part.trim().startsWith(`${SESSION_COOKIE}=`));
  if (session) safe.set("cookie", session.trim());
  after(async () => {
    try {
      await writeActivity(safe, input);
    } catch {
      console.warn("activity event storage temporarily unavailable");
    }
  });
}
export function logDownloadResponse(
  request: Request,
  response: Response,
  filePath: string,
  sourcePath = new URL(request.url).pathname,
): Response {
  const sessionId = correlateActivityResponse(request, response);
  logActivityLater(request, {
    eventType: "download_response",
    path: sourcePath,
    targetPath: filePath,
    channel: "server",
    sessionId,
    method: request.method,
    status: response.status,
    outcome: response.ok
      ? "response_prepared_not_confirmed_received"
      : "response_rejected",
    bytes:
      request.method === "HEAD"
        ? 0
        : response.ok
          ? Number(response.headers.get("content-length")) || null
          : null,
  });
  return response;
}

/** Dedicated analytics cookie only; never reuse or persist an authentication cookie. */
export function correlateActivityResponse(
  request: Request,
  response: Response,
): string | null {
  if (!activityEnabled()) return null;
  const session = activitySessionId(request.headers) || randomUUID();
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${session}; Path=/; Max-Age=1800; HttpOnly; Secure; SameSite=Lax`,
  );
  return session;
}
