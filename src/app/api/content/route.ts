import { NextRequest, NextResponse } from "next/server";
import { listContent } from "@/db/queries";
import type { WpLanguage } from "@/lib/wp/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const language = searchParams.get("language") as WpLanguage | null;
  const kind = searchParams.get("kind") ?? undefined;
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

  const records = await listContent({ language: language ?? undefined, kind, limit, offset });

  return NextResponse.json(records, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
