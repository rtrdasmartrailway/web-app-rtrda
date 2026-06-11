import { NextRequest, NextResponse } from "next/server";
import { getLatestPosts } from "@/db/queries";
import type { WpLanguage } from "@/lib/wp/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const language = (searchParams.get("language") ?? "th") as WpLanguage;
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);

  const posts = await getLatestPosts(language, limit);

  return NextResponse.json(posts, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
