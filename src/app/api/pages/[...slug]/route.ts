import { NextRequest, NextResponse } from "next/server";
import { getPageBySlug } from "@/db/queries";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string[] }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  // Reconstruct full path slug, e.g. /เกี่ยวกับ-สทร/mission
  const fullSlug = `/${slug.map(decodeURIComponent).join("/")}`;
  const item = await getPageBySlug(fullSlug);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
