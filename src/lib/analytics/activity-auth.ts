const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  Vary: "Cookie",
  "X-Robots-Tag": "noindex, nofollow",
};
export { PRIVATE_HEADERS };

/** Never forward PR Center cookies or trust browser-supplied roles. */
export async function requireActivityAdmin(
  headers: Headers,
  fetcher: typeof fetch = fetch,
): Promise<Response | null> {
  const session = headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => /^rtrda_activity_oidc_session=[A-Za-z0-9_-]{16,}$/.test(x));
  if (!session)
    return Response.json(
      { error: "Sign in required" },
      { status: 401, headers: PRIVATE_HEADERS },
    );
  try {
    const response = await fetcher("http://activity-report-auth:3101/session", {
      headers: { cookie: session },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok)
      return Response.json(
        { error: "Authentication denied or unavailable" },
        {
          status: response.status === 401 ? 401 : response.status === 403 ? 403 : 503,
          headers: PRIVATE_HEADERS,
        },
      );
    const result = await response.json();
    return result?.authorized === true
      ? null
      : Response.json(
          { error: "Activity viewer role required" },
          { status: 403, headers: PRIVATE_HEADERS },
        );
  } catch {
    return Response.json(
      { error: "Authentication unavailable" },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}
