import { NextResponse } from "next/server";
import { listPartners } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await listPartners();
  return NextResponse.json(items, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
