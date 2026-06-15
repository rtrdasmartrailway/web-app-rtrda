import { NextRequest, NextResponse } from "next/server";
import { listPages } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const parentSlugParam = searchParams.get("parent_slug");
  // parent_slug=__root__ returns top-level pages (parentSlug IS NULL)
  const parentSlug =
    parentSlugParam === "__root__" ? null : parentSlugParam ?? undefined;
  const limit = Math.min(Number(searchParams.get("limit") ?? 100), 500);

  // Rows are bilingual (title_th/title_en/…); the API returns both languages.
  const items = await listPages({ parentSlug, limit });
  return NextResponse.json(items, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
