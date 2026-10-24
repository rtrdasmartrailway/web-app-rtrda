import { NextResponse, type NextRequest } from "next/server";
import { INTRO_RETURN_COOKIE, introHomepageUrl } from "@/lib/intro-flow";
import { middleware } from "@/lib/request-policy";
import { checkSurveyAccess, surveyPrivateHeaders } from "@/lib/survey/survey-private";
import { activityEnabled, logActivityLater } from "@/lib/analytics/activity-store";
import {
  activityPath,
  isPageRequest,
  isPublicDocumentPath,
} from "@/lib/analytics/activity-contract";

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
  // Correlation cookies and event-specific outcomes must never be shared by a cache.
  // Runtime gated: production keeps its existing behavior until an approved rollout.
  if (
    activityEnabled() &&
    ["/api/analytics/events", "/sdc_download", "/r"].some(
      (base) => path === base || path.startsWith(`${base}/`),
    )
  ) {
    response.headers.set("cache-control", "private, no-store, max-age=0");
    response.headers.set("cdn-cache-control", "no-store");
  }
  if (activityEnabled() && (request.method === "GET" || request.method === "HEAD")) {
    const normalized = activityPath(path);
    if (
      normalized &&
      isPublicDocumentPath(normalized) &&
      response.headers.get("x-middleware-next") === "1"
    ) {
      const destination = new URL(`/logged-files-internal${path}`, request.url);
      destination.search = "";
      const download = NextResponse.rewrite(destination);
      download.headers.set("cache-control", "private, no-store");
      return download;
    }
    if (normalized && isPageRequest(normalized, request.headers)) {
      const forwarded = response.headers.get("x-middleware-next") === "1";
      logActivityLater(request, {
        eventType: "page_request",
        path: normalized,
        channel: "server",
        method: request.method,
        status: forwarded ? null : response.status,
        outcome: forwarded ? "forwarded_status_unobserved" : "proxy_response",
      });
    }
  }
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

    const redirect = NextResponse.redirect(new URL("/intro", introHomepageUrl(request)), {
      status: 307,
    });
    redirect.headers.set("cache-control", "private, no-store");
    return redirect;
  }

  return response;
}
