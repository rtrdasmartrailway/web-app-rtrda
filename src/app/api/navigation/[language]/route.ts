import { NextRequest, NextResponse } from "next/server";
import { getNavItems } from "@/db/queries";
import type { WpLanguage } from "@/lib/wp/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ language: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { language } = await context.params;

  if (language !== "th" && language !== "en") {
    return NextResponse.json({ error: "language must be 'th' or 'en'" }, { status: 400 });
  }

  const nav = await getNavItems(language as WpLanguage);

  return NextResponse.json(nav, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
