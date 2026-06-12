import { NextRequest, NextResponse } from "next/server";
import { listEvents } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const language = searchParams.get("language") ?? undefined;
  const from = searchParams.get("from") ?? undefined;   // ISO date: 2026-06-01
  const to = searchParams.get("to") ?? undefined;       // ISO date: 2026-06-30
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);

  const items = await listEvents({ language, from, to, limit });
  return NextResponse.json(items, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
