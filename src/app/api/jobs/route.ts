import { NextRequest, NextResponse } from "next/server";
import { listJobs } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const language = searchParams.get("language") ?? undefined;
  const isOpenParam = searchParams.get("is_open");
  const isOpen = isOpenParam === null ? undefined : isOpenParam !== "false";
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 200);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

  const items = await listJobs({ language, isOpen, limit, offset });
  return NextResponse.json(items, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
