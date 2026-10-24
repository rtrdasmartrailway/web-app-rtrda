const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  Vary: "Cookie",
  "X-Robots-Tag": "noindex, nofollow",
};
export { PRIVATE_HEADERS };

/** Resolve authority through the existing server-side SSO session, never browser claims. */
export async function requireActivityAdmin(
  headers: Headers,
  fetcher: typeof fetch = fetch,
): Promise<Response | null> {
  const cookie = headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("rtrda_pr_center_oidc_session="));
  if (!cookie)
    return Response.json(
      { error: "Sign in to PR Center, then return to this page." },
      { status: 401, headers: PRIVATE_HEADERS },
    );
  try {
    const response = await fetcher("http://pr-center-api:3100/session", {
      headers: { cookie },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok)
      return Response.json(
        {
          error:
            response.status === 401 ? "Sign in required" : "Authentication unavailable",
        },
        { status: response.status === 401 ? 401 : 503, headers: PRIVATE_HEADERS },
      );
    const session = await response.json();
    if (
      session.isRootAdministrator === true ||
      (Array.isArray(session.roleGrants) &&
        session.roleGrants.some(
          (grant: { role?: string; departmentId?: string | null }) =>
            grant.role === "RTRDA_ADMIN" && grant.departmentId === null,
        ))
    )
      return null;
    return Response.json(
      { error: "Global administrator access required" },
      { status: 403, headers: PRIVATE_HEADERS },
    );
  } catch {
    return Response.json(
      { error: "Authentication unavailable" },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}
