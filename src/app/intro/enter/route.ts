import { NextResponse } from "next/server";
import { INTRO_RETURN_COOKIE } from "@/lib/intro-flow";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url), {
    status: 303,
  });

  response.cookies.set(INTRO_RETURN_COOKIE, "1", {
    httpOnly: true,
    maxAge: 60,
    path: "/",
    sameSite: "lax",
    secure: true,
  });
  response.headers.set("cache-control", "private, no-store");
  return response;
}
