import { NextRequest, NextResponse } from "next/server";
import { listHeroSlides } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const language = searchParams.get("language") ?? undefined;
  const activeOnly = searchParams.get("active_only") !== "false";

  const items = await listHeroSlides({ language, activeOnly });
  return NextResponse.json(items, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
