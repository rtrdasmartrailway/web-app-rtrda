import { NextRequest, NextResponse } from "next/server";
import { getAllDownloads } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const group = searchParams.get("group") ?? undefined;

  const downloads = await getAllDownloads(group);

  return NextResponse.json(downloads, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
