import { NextResponse, type NextRequest } from "next/server";
import { INTRO_RETURN_COOKIE } from "@/lib/intro-flow";
import { middleware } from "@/lib/request-policy";
import { checkSurveyAccess, surveyPrivateHeaders } from "@/lib/survey/survey-private";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isSurvey = ["/rtrdaintranet/survey-dashboard", "/api/survey-dashboard"].some(
    (base) => path === base || path.startsWith(`${base}/`),
  );
  if (isSurvey) {
    const denied = await checkSurveyAccess(request.headers);
    if (denied) return denied;
  }
  const response = middleware(request);
  if (isSurvey) {
    for (const [key, value] of Object.entries(surveyPrivateHeaders))
      response.headers.set(key, value);
  }

  if (path === "/" && response.headers.get("x-middleware-next") === "1") {
    if (request.cookies.get(INTRO_RETURN_COOKIE)?.value === "1") {
      response.cookies.delete(INTRO_RETURN_COOKIE);
      response.headers.set("cache-control", "private, no-store");
      return response;
    }

    const redirect = NextResponse.redirect(new URL("/intro", request.url), {
      status: 307,
    });
    redirect.headers.set("cache-control", "private, no-store");
    return redirect;
  }

  return response;
}
