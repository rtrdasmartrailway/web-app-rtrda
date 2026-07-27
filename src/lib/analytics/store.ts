import { createHmac } from "node:crypto";
import { Pool } from "pg";
import type { AnalyticsEventPayload } from "./event-contract";
import { detectAnalyticsDevice, safeReferrerHost } from "./event-contract";

const globalAnalytics = globalThis as unknown as {
  analyticsPool?: Pool;
  analyticsTableReady?: Promise<void>;
  analyticsLastCleanup?: number;
};

function pool(): Pool {
  if (!globalAnalytics.analyticsPool) {
    globalAnalytics.analyticsPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return globalAnalytics.analyticsPool;
}

function environment(): "test" | "production" {
  return process.env.ANALYTICS_ENV === "production" ? "production" : "test";
}

function secret(): string {
  const value = process.env.ANALYTICS_HASH_SALT;
  if (!value) throw new Error("ANALYTICS_HASH_SALT is required");
  return value;
}

export function anonymousHashes(
  ip: string | null,
  sessionId: string,
  now = new Date(),
): { visitorHash: string | null; sessionHash: string } {
  const day = now.toISOString().slice(0, 10);
  const visitorHash = ip
    ? createHmac("sha256", secret()).update(`${day}:${ip}`).digest("hex")
    : null;
  const sessionHash = createHmac("sha256", secret())
    .update(`${visitorHash ?? "unknown"}:${sessionId}`)
    .digest("hex");
  return { visitorHash, sessionHash };
}

async function ensureTable(): Promise<void> {
  if (!globalAnalytics.analyticsTableReady) {
    globalAnalytics.analyticsTableReady = pool()
      .query(
        `
      CREATE TABLE IF NOT EXISTS web_analytics_events (
        id BIGSERIAL PRIMARY KEY,
        event_id UUID NOT NULL UNIQUE,
        environment TEXT NOT NULL CHECK (environment IN ('test','production')),
        event_type TEXT NOT NULL CHECK (event_type IN ('page_view','link_click','download')),
        path TEXT NOT NULL,
        target_path TEXT,
        source TEXT,
        referrer_host TEXT,
        device_type TEXT NOT NULL,
        visitor_hash TEXT,
        session_hash TEXT NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS web_analytics_events_env_time_idx ON web_analytics_events (environment, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS web_analytics_events_env_type_time_idx ON web_analytics_events (environment, event_type, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS web_analytics_events_env_path_time_idx ON web_analytics_events (environment, path, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS web_analytics_events_env_target_time_idx ON web_analytics_events (environment, target_path, occurred_at DESC);
    `,
      )
      .then(() => undefined);
  }
  return globalAnalytics.analyticsTableReady;
}

async function maybeCleanup(now = Date.now()): Promise<void> {
  if (
    globalAnalytics.analyticsLastCleanup &&
    now - globalAnalytics.analyticsLastCleanup < 86_400_000
  )
    return;
  globalAnalytics.analyticsLastCleanup = now;
  await pool().query(
    "DELETE FROM web_analytics_events WHERE occurred_at < NOW() - INTERVAL '180 days'",
  );
}

export async function storeAnalyticsEvent(input: {
  event: AnalyticsEventPayload;
  ip: string | null;
  userAgent: string;
  referrer: string | null;
}): Promise<boolean> {
  await ensureTable();
  const hashes = anonymousHashes(input.ip, input.event.sessionId);
  const result = await pool().query(
    `INSERT INTO web_analytics_events
      (event_id, environment, event_type, path, target_path, source, referrer_host, device_type, visitor_hash, session_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (event_id) DO NOTHING`,
    [
      input.event.eventId,
      environment(),
      input.event.eventType,
      input.event.path,
      input.event.targetPath,
      input.event.source,
      safeReferrerHost(input.referrer),
      detectAnalyticsDevice(input.userAgent),
      hashes.visitorHash,
      hashes.sessionHash,
    ],
  );
  void maybeCleanup().catch(() => undefined);
  return (result.rowCount ?? 0) > 0;
}
