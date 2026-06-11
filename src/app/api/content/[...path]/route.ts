import { NextRequest, NextResponse } from "next/server";
import { getContentByPath } from "@/db/queries";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const resolvedPath = `/${path.join("/")}`;

  const record = await getContentByPath(resolvedPath);

  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(record, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
