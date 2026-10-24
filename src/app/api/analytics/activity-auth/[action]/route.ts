import { PRIVATE_HEADERS } from "@/lib/analytics/activity-auth";
export const dynamic = "force-dynamic";
const origin = "http://activity-report-auth:3101";
type Ctx = { params: Promise<{ action: string }> };
const APEX = "rtrda.or.th";
const WWW = "www.rtrda.or.th";
const INTERNAL = new Set([
  "localhost:3000",
  "127.0.0.1:3000",
  "web-app-rtrda-production:3000",
]);

/** Never trust the internal listener URL as the public cookie authority. */
function publicHost(request: Request): string | null {
  const host = request.headers.get("host") ?? new URL(request.url).host;
  const forwarded = request.headers.get("x-forwarded-host");
  if (host === APEX || host === WWW)
    return !forwarded || forwarded === host ? host : null;
  if (INTERNAL.has(host) && (forwarded === APEX || forwarded === WWW)) return forwarded;
  return null;
}

async function proxy(request: Request, action: string, method: "GET" | "POST") {
  if (
    !["login", "callback", "logout"].includes(action) ||
    (action === "logout") !== (method === "POST")
  )
    return new Response(null, { status: 405, headers: PRIVATE_HEADERS });
  const host = publicHost(request);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (
    !host ||
    (forwardedProto !== null &&
      forwardedProto !== "http" &&
      forwardedProto !== "https") ||
    (action !== "login" &&
      (forwardedProto === "http" ||
        (new URL(request.url).protocol !== "https:" && forwardedProto !== "https"))) ||
    (action === "callback" && host !== APEX)
  )
    return new Response(null, { status: 403, headers: PRIVATE_HEADERS });
  if (
    action === "login" &&
    (host !== APEX ||
      request.headers.get("x-forwarded-proto") === "http" ||
      (!request.headers.has("x-forwarded-proto") &&
        new URL(request.url).protocol !== "https:"))
  ) {
    const headers = new Headers(PRIVATE_HEADERS);
    headers.set("Location", `https://${APEX}/api/analytics/activity-auth/login`);
    return new Response(null, { status: 308, headers });
  }
  if (method === "POST") {
    const source = request.headers.get("origin");
    if (!source || source !== `https://${host}`)
      return new Response(null, { status: 403, headers: PRIVATE_HEADERS });
  }
  const session =
    request.headers
      .get("cookie")
      ?.split(";")
      .map((x) => x.trim())
      .filter((x) => /^rtrda_activity_oidc_(session|state)=[A-Za-z0-9_-]+$/.test(x))
      .join("; ") || "";
  try {
    const query = action === "callback" ? new URL(request.url).search : "";
    const response = await fetch(`${origin}/auth/${action}${query}`, {
      method,
      headers: { cookie: session },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    if (response.status !== 302)
      return new Response(null, { status: 503, headers: PRIVATE_HEADERS });
    const location = response.headers.get("location");
    if (
      !location ||
      (action === "login"
        ? !location.startsWith("https://login.microsoftonline.com/")
        : ![
            "/rtrdaintranet/activity-log",
            "/rtrdaintranet/activity-log?signin=failed",
          ].includes(location))
    )
      return new Response(null, { status: 503, headers: PRIVATE_HEADERS });
    const headers = new Headers(PRIVATE_HEADERS);
    headers.set("Location", location);
    for (const line of response.headers.getSetCookie())
      if (/^rtrda_activity_oidc_(session|state)=/.test(line))
        headers.append("Set-Cookie", line);
    return new Response(null, { status: 302, headers });
  } catch {
    return new Response(null, { status: 503, headers: PRIVATE_HEADERS });
  }
}
export async function GET(request: Request, context: Ctx) {
  if (process.env.ACTIVITY_REPORT_ENABLED === "false")
    return new Response(null, { status: 404, headers: PRIVATE_HEADERS });
  return proxy(request, (await context.params).action, "GET");
}
export async function POST(request: Request, context: Ctx) {
  if (process.env.ACTIVITY_REPORT_ENABLED === "false")
    return new Response(null, { status: 404, headers: PRIVATE_HEADERS });
  return proxy(request, (await context.params).action, "POST");
}
