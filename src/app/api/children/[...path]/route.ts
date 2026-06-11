import { NextRequest, NextResponse } from "next/server";
import { getChildPages } from "@/db/queries";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const parentPath = `/${path.join("/")}`;

  const children = await getChildPages(parentPath);

  return NextResponse.json(children, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
