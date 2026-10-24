import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy as siteProxy } from "@/proxy";
import { GET, POST } from "@/app/api/analytics/activity-auth/[action]/route";
import {
  activitySettings,
  buildActivityAuthApi,
  createActivityAuth,
} from "@/activity-report-auth/auth";

afterEach(() => vi.unstubAllGlobals());
const ctx = (action: string) => ({ params: Promise.resolve({ action }) });
const base = "https://rtrda.or.th/api/analytics/activity-auth/";

it("requires apex callback configuration so host-only login state returns to its issuing host", () => {
  const original = { ...process.env };
  try {
    process.env.ACTIVITY_OIDC_TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    process.env.ACTIVITY_OIDC_CLIENT_ID = "synthetic-id";
    process.env.ACTIVITY_OIDC_CLIENT_SECRET = "synthetic-secret";
    process.env.ACTIVITY_OIDC_ISSUER = `https://login.microsoftonline.com/${process.env.ACTIVITY_OIDC_TENANT_ID}/v2.0`;
    process.env.ACTIVITY_OIDC_REDIRECT_URI = `${base}callback`;
    expect(activitySettings()).not.toBeNull();
    process.env.ACTIVITY_OIDC_REDIRECT_URI =
      "https://www.rtrda.or.th/api/analytics/activity-auth/callback";
    expect(activitySettings()).toBeNull();
  } finally {
    for (const key of [
      "ACTIVITY_OIDC_TENANT_ID",
      "ACTIVITY_OIDC_CLIENT_ID",
      "ACTIVITY_OIDC_CLIENT_SECRET",
      "ACTIVITY_OIDC_ISSUER",
      "ACTIVITY_OIDC_REDIRECT_URI",
    ]) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});

it("passes POST logout through proxy to the real route and revokes the session", async () => {
  const settings = {
    tenantId: "tenant-a",
    clientId: "client-a",
    clientSecret: "synthetic",
    issuer: "https://login.microsoftonline.com/tenant-a/v2.0",
    redirectUri: `${base}callback`,
  };
  const auth = createActivityAuth(settings, {
    begin: async () => "https://login.microsoftonline.com/tenant-a/authorize",
    exchange: async () => ({
      iss: settings.issuer,
      aud: settings.clientId,
      tid: settings.tenantId,
      sub: "viewer",
      exp: 9999999999,
      roles: ["RTRDA_ACTIVITY_REPORT_VIEWER"],
    }),
  });
  const app = buildActivityAuthApi(auth);
  try {
    const start = await auth.begin();
    const session = await auth.callback({
      cookie: start.cookie,
      state: start.state,
      code: "synthetic",
    });
    expect(auth.resolve(session.cookie)).toBe(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (init.method !== "POST") throw new Error("Unexpected auth method");
        const res = await app.inject({
          method: "POST",
          url: new URL(url).pathname,
          headers: { cookie: (init.headers as Record<string, string>).cookie },
        });
        const headers = new Headers({ location: String(res.headers.location || "") });
        const cookies = res.headers["set-cookie"];
        for (const line of Array.isArray(cookies) ? cookies : cookies ? [cookies] : [])
          headers.append("set-cookie", line);
        return new Response(null, { status: res.statusCode, headers });
      }),
    );
    const url = `${base}logout`;
    expect((await siteProxy(new NextRequest(url, { method: "POST" }))).status).toBe(200);
    const response = await POST(
      new Request(url, {
        method: "POST",
        headers: {
          origin: "https://rtrda.or.th",
          cookie: session.cookie,
        },
      }),
      ctx("logout"),
    );
    expect(response.status).toBe(302);
    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("rtrda_activity_oidc_session=;"),
        expect.stringContaining("rtrda_activity_oidc_state=;"),
      ]),
    );
    expect(
      response.headers
        .getSetCookie()
        .every((line) => line.includes("Max-Age=0") && !line.includes("Domain=")),
    ).toBe(true);
    expect(auth.resolve(session.cookie)).toBe(false);
    expect((await siteProxy(new NextRequest(url, { method: "DELETE" }))).status).toBe(
      405,
    );
    expect(
      (
        await siteProxy(
          new NextRequest("https://rtrda.or.th/api/analytics/reports", {
            method: "POST",
          }),
        )
      ).status,
    ).toBe(405);
    expect(
      (
        await siteProxy(
          new NextRequest(`http://rtrda.or.th/api/analytics/activity-auth/logout`, {
            method: "POST",
            headers: { host: "rtrda.or.th", "x-forwarded-proto": "http" },
          }),
        )
      ).status,
    ).toBe(308);
    expect((await siteProxy(new NextRequest("https://rtrda.or.th/"))).status).toBe(307);
  } finally {
    await app.close();
  }
});

it("redirects www login to HTTPS apex before creating a host-only state cookie", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(null, {
      status: 302,
      headers: {
        location: "https://login.microsoftonline.com/tenant-a/authorize",
        "set-cookie":
          "rtrda_activity_oidc_state=synthetic; Path=/; HttpOnly; Secure; SameSite=Lax",
      },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  const www = await GET(
    new Request(`${base.replace("rtrda.or.th", "www.rtrda.or.th")}login`),
    ctx("login"),
  );
  expect(www.status).toBe(308);
  expect(www.headers.get("location")).toBe(`${base}login`);
  expect(www.headers.getSetCookie()).toEqual([]);
  const internalHeaders = {
    host: "localhost:3000",
    "x-forwarded-host": "www.rtrda.or.th",
    "x-forwarded-proto": "https",
  };
  const internal = await GET(
    new Request("http://localhost:3000/api/analytics/activity-auth/login", {
      headers: internalHeaders,
    }),
    ctx("login"),
  );
  expect(internal.status).toBe(308);
  expect(internal.headers.get("location")).toBe(`${base}login`);
  expect(fetcher).not.toHaveBeenCalled();
  const apexHeaders = { ...internalHeaders, "x-forwarded-host": "rtrda.or.th" };
  const apex = await GET(
    new Request("http://localhost:3000/api/analytics/activity-auth/login", {
      headers: apexHeaders,
    }),
    ctx("login"),
  );
  expect(apex.status).toBe(302);
  expect(apex.headers.getSetCookie()[0]).toContain("rtrda_activity_oidc_state=");
  expect(apex.headers.getSetCookie()[0]).not.toContain("Domain=");
  fetcher.mockResolvedValue(
    new Response(null, {
      status: 302,
      headers: {
        location: "/rtrdaintranet/activity-log",
        "set-cookie":
          "rtrda_activity_oidc_session=synthetic; Path=/; HttpOnly; Secure; SameSite=Strict",
      },
    }),
  );
  const callback = await GET(
    new Request(
      "http://localhost:3000/api/analytics/activity-auth/callback?code=synthetic&state=synthetic",
      {
        headers: { ...apexHeaders, cookie: "rtrda_activity_oidc_state=synthetic" },
      },
    ),
    ctx("callback"),
  );
  expect(callback.status).toBe(302);
  expect(callback.headers.getSetCookie()[0]).not.toContain("Domain=");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("accepts apex-origin logout behind an internal Host and advertises only POST", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "/rtrdaintranet/activity-log" },
      }),
    ),
  );
  const url = "http://localhost:3000/api/analytics/activity-auth/logout";
  const headers = {
    host: "localhost:3000",
    "x-forwarded-host": "rtrda.or.th",
    "x-forwarded-proto": "https",
    origin: "https://rtrda.or.th",
  };
  expect(
    (await siteProxy(new NextRequest(url, { method: "OPTIONS", headers }))).headers.get(
      "Allow",
    ),
  ).toBe("POST, OPTIONS");
  expect(
    (await siteProxy(new NextRequest(url, { method: "POST", headers }))).status,
  ).toBe(200);
  const response = await POST(
    new Request(url, { method: "POST", headers }),
    ctx("logout"),
  );
  expect(response.status).toBe(302);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it.each([
  ["evil.example", "rtrda.or.th"],
  ["localhost:3000", "evil.example"],
  ["localhost:3000", "www.rtrda.or.th, evil.example"],
  ["rtrda.or.th", "www.rtrda.or.th"],
  ["localhost:3000", "rtrda.or.th:443"],
  ["localhost:3000", "https://rtrda.or.th"],
  ["localhost:3000", ""],
  ["localhost:3000", "rtrda.or.th,evil.example"],
  ["localhost:3000", "rtrda.or.th.evil.example"],
])(
  "denies untrusted login host %s and forwarded host %s before state creation",
  async (host, forwarded) => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const headers = new Headers({ host });
    if (forwarded) headers.set("x-forwarded-host", forwarded);
    const response = await GET(
      new Request("http://localhost:3000/api/analytics/activity-auth/login", { headers }),
      ctx("login"),
    );
    expect(response.status).toBe(403);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  },
);

it("rejects malformed forwarded protocol before creating login state", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  for (const proto of ["https,http", "ftp", "", "https://evil.example"]) {
    const response = await GET(
      new Request("http://localhost:3000/api/analytics/activity-auth/login", {
        headers: {
          host: "localhost:3000",
          "x-forwarded-host": "rtrda.or.th",
          "x-forwarded-proto": proto,
        },
      }),
      ctx("login"),
    );
    expect(response.status).toBe(403);
    expect(response.headers.getSetCookie()).toEqual([]);
  }
  expect(fetcher).not.toHaveBeenCalled();
});

it("does not complete callback or logout on an internal HTTP request without trusted HTTPS forwarding", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(null, {
      status: 302,
      headers: { location: "/rtrdaintranet/activity-log" },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  const headers = { host: "localhost:3000", "x-forwarded-host": "rtrda.or.th" };
  const callback = await GET(
    new Request(
      "http://localhost:3000/api/analytics/activity-auth/callback?state=synthetic&code=synthetic",
      { headers },
    ),
    ctx("callback"),
  );
  expect(callback.status).toBe(403);
  const logout = await POST(
    new Request("http://localhost:3000/api/analytics/activity-auth/logout", {
      method: "POST",
      headers: { ...headers, origin: "https://rtrda.or.th" },
    }),
    ctx("logout"),
  );
  expect(logout.status).toBe(403);
  expect(fetcher).not.toHaveBeenCalled();
});
