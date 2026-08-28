import { NextResponse, type NextRequest } from "next/server";

const BROKEN_O5_PATH =
  "/%25E0%25%2520%2520B8%2584%25E0%25B8%25B9%25E0%25%2520%2520B9%2588%25E0%25B8%25A1%25E0%25%2520%2520B8%25B7%25E0%25B8%25ADO5";

const BROKEN_O10_ESERVICE_PDF_PATHS = [
  "/wp-content/uploads/ita2569/O10/o10-%25E0%25B8%2584%25E0%25B8%25B9%2520%2520%25E0%25B9%2588%25E0%25B8%25A1%25E0%25B%2520%25208%25B7%25E0%25B8%25AD%25E0%25B8%2581%2520%2520%25E0%25B8%25B2%25E0%25B8%25A3%25E%2520%25200%25B9%2583%25E0%25B8%25AB%25E0%25B9%258%2520%25209%25E0%25B8%259A%25E0%25B8%25A3%25E0%2520%2520%25B8%25B4%25E0%25B8%2581%25E0%25B8%2520%2520%25B2%25E0%25B8%25A3-E-Service.pdf",
  "/wp-content/uploads/ita2569/O10/o10-%25E0%25B8%2584%25E0%25B8%25B9%2520%2520%25E0%25B9%2588%25E0%25B8%25A1%25E0%25B%2520%25208%25B7%25E0%25B8%25AD%25E0%25B8%2581%2520%2520%25E0%25B8%25B2%25E0%25B8%25A3%25E%2520%25200%25B9%2583%25E0%25B8%25AB%25E0%25B9%258%2520%25209%25E0%25B8%259A%25E0%25B8%25A3%25E0%2520%2520%25B8%25B4%25E0%25B8%2581%25E0%25B8%2520%2520%25B2%25E0%B8%25A3-E-Service.pdf",
];

const CANONICAL_O10_ESERVICE_PDF_PATH =
  "/wp-content/uploads/ita2569/O10/o10-%E0%B8%84%E0%B8%B9%E0%B9%88%E0%B8%A1%E0%B8%B7%E0%B8%AD%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B9%83%E0%B8%AB%E0%B9%89%E0%B8%9A%E0%B8%A3%E0%B8%B4%E0%B8%81%E0%B8%B2%E0%B8%A3-E-Service.pdf";

const ALLOWED_METHODS = "GET, HEAD, OPTIONS";
const ANALYTICS_METHODS = "POST, OPTIONS";
const ANALYTICS_EVENT_PATH = "/api/analytics/events";
const HEALTH_PATHS = new Set(["/healthz", "/api/health"]);
const PUBLIC_HOSTS = new Set(["rtrda.or.th", "www.rtrda.or.th", "test.rtrda.or.th"]);
const DOCUMENT_LANGUAGE_HEADER = "x-rtrda-document-language";

function firstForwardedValue(value: string | null): string {
  return value?.split(",")[0]?.trim().toLowerCase() ?? "";
}

function httpsRedirect(request: NextRequest): NextResponse | null {
  if (HEALTH_PATHS.has(new URL(request.url).pathname)) {
    return null;
  }
  if (firstForwardedValue(request.headers.get("x-forwarded-proto")) !== "http") {
    return null;
  }

  const forwardedHost = firstForwardedValue(request.headers.get("x-forwarded-host"));
  const requestHost = firstForwardedValue(request.headers.get("host"));
  const publicHost = [forwardedHost, requestHost, request.nextUrl.hostname]
    .map((value) => value.split(":")[0])
    .find((value) => PUBLIC_HOSTS.has(value));
  if (!publicHost) return null;

  const target = new URL(request.url);
  target.protocol = "https:";
  target.hostname = publicHost;
  target.port = "";
  return NextResponse.redirect(target, 308);
}

function methodPolicy(request: NextRequest): NextResponse | null {
  const path = new URL(request.url).pathname;
  const analyticsRequest = path === ANALYTICS_EVENT_PATH;

  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: { Allow: analyticsRequest ? ANALYTICS_METHODS : ALLOWED_METHODS },
    });
  }

  if (analyticsRequest && request.method === "POST") return null;

  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.json(
      { error: "Method not allowed" },
      {
        status: 405,
        headers: { Allow: analyticsRequest ? ANALYTICS_METHODS : ALLOWED_METHODS },
      },
    );
  }

  return null;
}

export function middleware(request: NextRequest) {
  const methodResponse = methodPolicy(request);
  if (methodResponse) return methodResponse;

  const redirectResponse = httpsRedirect(request);
  if (redirectResponse) return redirectResponse;

  const rawPath = new URL(request.url).pathname;

  if (rawPath === BROKEN_O5_PATH) {
    return NextResponse.rewrite(
      new URL("/%E0%B8%84%E0%B8%B9%E0%B9%88%E0%B8%A1%E0%B8%B7%E0%B8%ADO5", request.url),
    );
  }

  if (BROKEN_O10_ESERVICE_PDF_PATHS.includes(rawPath)) {
    return NextResponse.rewrite(new URL(CANONICAL_O10_ESERVICE_PDF_PATH, request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    DOCUMENT_LANGUAGE_HEADER,
    rawPath === "/en" || rawPath.startsWith("/en/") ? "en" : "th",
  );
  return NextResponse.next({ request: { headers: requestHeaders } });
}
