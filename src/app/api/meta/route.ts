import { NextResponse } from "next/server";
import { getGeneratedAt } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const generatedAt = await getGeneratedAt();

  return NextResponse.json({ generatedAt }, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
