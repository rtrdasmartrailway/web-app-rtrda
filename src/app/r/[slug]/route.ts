import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ slug: string }> };

const targets: Record<string, { campaign: string; targetUrl: string }> = {
  "mot-5440": {
    campaign: "signed_2569_MOT_5440",
    targetUrl:
      "https://docs.google.com/forms/d/e/1FAIpQLSeoTp0t8B1l7QbHFO6nHsmD8QHmhnaM6_yPJtRkPJZJ5NHcAw/viewform",
  },
};

const globalForRedirectTracking = globalThis as unknown as {
  redirectTrackingPool?: Pool;
  redirectTrackingTableReady?: Promise<void>;
};

function getPool(): Pool {
  if (!globalForRedirectTracking.redirectTrackingPool) {
    globalForRedirectTracking.redirectTrackingPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return globalForRedirectTracking.redirectTrackingPool;
}

async function ensureTable(): Promise<void> {
  if (!globalForRedirectTracking.redirectTrackingTableReady) {
    globalForRedirectTracking.redirectTrackingTableReady = getPool()
      .query(
        `
      CREATE TABLE IF NOT EXISTS redirect_clicks (
        id BIGSERIAL PRIMARY KEY,
        click_id UUID NOT NULL UNIQUE,
        campaign TEXT NOT NULL,
        source TEXT,
        target_url TEXT NOT NULL,
        ip_hash TEXT,
        user_agent TEXT,
        referrer TEXT,
        device_type TEXT,
        clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        redirected_at TIMESTAMPTZ,
        redirect_status TEXT NOT NULL DEFAULT 'redirected'
      );
      CREATE INDEX IF NOT EXISTS redirect_clicks_campaign_clicked_at_idx
        ON redirect_clicks (campaign, clicked_at DESC);
    `,
      )
      .then(() => undefined);
  }
  return globalForRedirectTracking.redirectTrackingTableReady;
}

function firstHeaderValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

function detectDevice(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobile|iphone|android/.test(ua)) return "mobile";
  if (!ua) return "unknown";
  return "desktop";
}

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt =
    process.env.REDIRECT_TRACKING_SALT ||
    process.env.SITE_ORIGIN ||
    "rtrda-redirect-tracking";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const target = targets[slug];

  if (!target) {
    return NextResponse.json({ error: "Unknown redirect campaign" }, { status: 404 });
  }

  const clickId = randomUUID();
  const source = request.nextUrl.searchParams.get("src") || "direct";
  const userAgent = request.headers.get("user-agent") || "";
  const referrer =
    request.headers.get("referer") || request.headers.get("referrer") || "";
  const ip =
    firstHeaderValue(request.headers.get("cf-connecting-ip")) ||
    firstHeaderValue(request.headers.get("x-forwarded-for")) ||
    firstHeaderValue(request.headers.get("x-real-ip"));

  try {
    await ensureTable();
    await getPool().query(
      `INSERT INTO redirect_clicks
        (click_id, campaign, source, target_url, ip_hash, user_agent, referrer, device_type, redirected_at, redirect_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 'redirected')`,
      [
        clickId,
        target.campaign,
        source.slice(0, 120),
        target.targetUrl,
        hashIp(ip),
        userAgent.slice(0, 1000),
        referrer.slice(0, 1000),
        detectDevice(userAgent),
      ],
    );
  } catch (error) {
    // Do not block users from reaching the official form if tracking fails.
    console.error("redirect tracking failed", error);
  }

  return NextResponse.redirect(target.targetUrl, { status: 302 });
}
