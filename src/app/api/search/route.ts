import { NextRequest, NextResponse } from "next/server";
import { searchContent } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q") ?? "";
  const limit = Math.min(Number(searchParams.get("limit") ?? 80), 200);

  if (!q.trim()) {
    return NextResponse.json([], {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const results = await searchContent(q.trim(), limit);

  return NextResponse.json(results, {
    headers: { "Cache-Control": "no-store" },
  });
}
