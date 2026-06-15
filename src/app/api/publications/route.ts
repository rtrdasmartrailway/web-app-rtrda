import { NextRequest, NextResponse } from "next/server";
import { listPublications } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category") ?? undefined;
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 200);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

  // Rows are bilingual (title_th/title_en/…); the API returns both languages.
  const items = await listPublications({ category, limit, offset });
  return NextResponse.json(items, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
