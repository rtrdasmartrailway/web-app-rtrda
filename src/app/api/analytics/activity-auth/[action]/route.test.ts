import { afterEach, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
afterEach(() => vi.unstubAllGlobals());
const ctx = (action: string) => ({ params: Promise.resolve({ action }) });
it("fails closed when the service is unavailable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Error("offline")));
  expect(
    (
      await GET(
        new Request("https://rtrda.or.th/api/analytics/activity-auth/login"),
        ctx("login"),
      )
    ).status,
  ).toBe(503);
});
it("forwards only dedicated activity cookies and approved redirect/cookies", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(null, {
      status: 302,
      headers: {
        location: "/rtrdaintranet/activity-log",
        "set-cookie":
          "rtrda_activity_oidc_session=token; Secure; HttpOnly; SameSite=Strict",
      },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  const response = await GET(
    new Request(
      "https://rtrda.or.th/api/analytics/activity-auth/callback?code=synthetic&state=synthetic",
      {
        headers: {
          cookie: "rtrda_pr_center_oidc_session=secret; rtrda_activity_oidc_state=state",
        },
      },
    ),
    ctx("callback"),
  );
  expect(response.status).toBe(302);
  expect(response.headers.get("set-cookie")).toContain("rtrda_activity_oidc_session");
  expect(fetcher.mock.calls[0][1].headers.cookie).toBe("rtrda_activity_oidc_state=state");
  fetcher.mockResolvedValue(
    new Response(null, { status: 302, headers: { location: "https://evil.example/" } }),
  );
  expect(
    (
      await GET(
        new Request("https://rtrda.or.th/api/analytics/activity-auth/login"),
        ctx("login"),
      )
    ).status,
  ).toBe(503);
});
it("rejects cross-origin logout", async () => {
  vi.stubGlobal("fetch", vi.fn());
  const response = await POST(
    new Request("https://rtrda.or.th/api/analytics/activity-auth/logout", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    }),
    ctx("logout"),
  );
  expect(response.status).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
});

it("collector-only mode hides login and logout without contacting auth service", async () => {
  process.env.ACTIVITY_REPORT_ENABLED = "false";
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  try {
    expect(
      (
        await GET(
          new Request("https://rtrda.or.th/api/analytics/activity-auth/login"),
          ctx("login"),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await POST(
          new Request("https://rtrda.or.th/api/analytics/activity-auth/logout", {
            method: "POST",
          }),
          ctx("logout"),
        )
      ).status,
    ).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  } finally {
    delete process.env.ACTIVITY_REPORT_ENABLED;
  }
});
