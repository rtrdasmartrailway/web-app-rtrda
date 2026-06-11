import { NextRequest, NextResponse } from "next/server";
import { getDownloadById } from "@/db/queries";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const download = await getDownloadById(decodeURIComponent(id));

  if (!download) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(download, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
