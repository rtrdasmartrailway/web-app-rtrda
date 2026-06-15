import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Coarse UX gate ONLY. This redirects users with no session cookie away from the
// content-management area to the login page. It performs NO role/authorization
// logic — the real authorization boundary lives inside every server action and
// route handler (see src/lib/session.ts requirePermission/requireAdmin). The Next
// docs warn against relying on the proxy for authz, so we don't.
// DEV-ONLY bypass (see src/lib/session.ts). When on, skip the gate entirely.
const DEV_AUTH_BYPASS =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "1";

export function proxy(request: NextRequest) {
  if (DEV_AUTH_BYPASS) return NextResponse.next();
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const loginUrl = new URL("/rtrdaintranet/login", request.url);
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/rtrdaintranet/manage/:path*"],
};
