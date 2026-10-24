import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activitySettings,
  buildActivityAuthApi,
  createActivityAuth,
  type VerifiedClaims,
} from "./auth";

const cfg = {
  tenantId: "tenant-a",
  clientId: "client-a",
  clientSecret: "synthetic",
  issuer: "https://login.microsoftonline.com/tenant-a/v2.0",
  redirectUri: "https://rtrda.or.th/api/analytics/activity-auth/callback",
};
const claims: VerifiedClaims = {
  iss: cfg.issuer,
  aud: cfg.clientId,
  tid: cfg.tenantId,
  sub: "subject",
  exp: 9999999999,
  roles: ["RTRDA_ACTIVITY_REPORT_VIEWER"],
};
const gateway = () => ({
  begin: vi
    .fn()
    .mockResolvedValue(
      "https://login.microsoftonline.com/tenant-a/oauth2/v2.0/authorize?state=test",
    ),
  exchange: vi.fn().mockResolvedValue(claims),
});
afterEach(() => vi.restoreAllMocks());
describe("isolated activity report sign-in", () => {
  it.each([
    [{ ...claims, roles: [] }, 403],
    [{ ...claims, roles: ["RTRDA_ADMIN"] }, 403],
    [{ ...claims, tid: "other" }, 403],
    [{ ...claims, iss: "https://evil.example" }, 403],
    [{ ...claims, aud: "other" }, 403],
    [{ ...claims, exp: 1 }, 403],
    [{ ...claims, sub: "" }, 403],
  ])("rejects invalid verified identity %#", async (identity, status) => {
    const oidc = gateway();
    oidc.exchange.mockResolvedValue(identity);
    const auth = createActivityAuth(cfg, oidc);
    const start = await auth.begin();
    await expect(
      auth.callback({ cookie: start.cookie, state: start.state, code: "synthetic" }),
    ).rejects.toMatchObject({ statusCode: status });
  });
  it("uses state, nonce and PKCE, rejects replay, and revokes/logout or failover sessions", async () => {
    const oidc = gateway();
    const auth = createActivityAuth(cfg, oidc);
    const start = await auth.begin();
    expect(start.cookie).toContain("rtrda_activity_oidc_state=");
    expect(start.cookie).toContain("Secure; SameSite=Lax");
    expect(oidc.begin.mock.calls[0][0]).toMatchObject({
      state: start.state,
      nonce: expect.any(String),
      verifier: expect.any(String),
    });
    await expect(
      auth.callback({ cookie: start.cookie, state: "wrong", code: "synthetic" }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(oidc.exchange).not.toHaveBeenCalled();
    const result = await auth.callback({
      cookie: start.cookie,
      state: start.state,
      code: "synthetic",
    });
    expect(oidc.exchange.mock.calls[0][0]).toMatchObject({
      expectedState: start.state,
      expectedNonce: oidc.begin.mock.calls[0][0].nonce,
      pkceCodeVerifier: oidc.begin.mock.calls[0][0].verifier,
    });
    expect(result.cookie).toContain("rtrda_activity_oidc_session=");
    expect(result.cookie).toContain("HttpOnly; Secure; SameSite=Strict");
    expect(auth.resolve(result.cookie)).toBe(true);
    expect(auth.resolve("rtrda_pr_center_oidc_session=synthetic")).toBe(false);
    expect(auth.resolve("rtrda_activity_oidc_session=forged")).toBe(false);
    expect(createActivityAuth(cfg, gateway()).resolve(result.cookie)).toBe(false);
    await expect(
      auth.callback({ cookie: start.cookie, state: start.state, code: "synthetic" }),
    ).rejects.toMatchObject({ statusCode: 400 });
    auth.logout(result.cookie);
    expect(auth.resolve(result.cookie)).toBe(false);
  });
  it("denies a failed nonce check and expired callback state without issuing a session", async () => {
    const oidc = gateway();
    const auth = createActivityAuth(cfg, oidc);
    const stale = await auth.begin();
    const current = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(current + 601000);
    await expect(
      auth.callback({ cookie: stale.cookie, state: stale.state, code: "synthetic" }),
    ).rejects.toMatchObject({ statusCode: 400 });
    vi.mocked(Date.now).mockRestore();
    const start = await auth.begin();
    oidc.exchange.mockRejectedValueOnce(new Error("nonce mismatch"));
    await expect(
      auth.callback({ cookie: start.cookie, state: start.state, code: "synthetic" }),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(
      auth.resolve("rtrda_activity_oidc_session=synthetic0000000000000000000000"),
    ).toBe(false);
    await expect(
      auth.callback({ cookie: start.cookie, state: start.state, code: "synthetic" }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it("expires sessions and does not log cookies, codes, or tokens", async () => {
    const log = vi.spyOn(console, "log");
    const auth = createActivityAuth(cfg, gateway());
    const start = await auth.begin();
    const result = await auth.callback({
      cookie: start.cookie,
      state: start.state,
      code: "synthetic",
    });
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 31 * 60 * 1000);
    expect(auth.resolve(result.cookie)).toBe(false);
    const app = buildActivityAuthApi(auth);
    const response = await app.inject({
      method: "GET",
      url: "/session",
      headers: {
        cookie: "rtrda_activity_oidc_session=forged; rtrda_pr_center_oidc_session=secret",
      },
    });
    expect(response.statusCode).toBe(401);
    expect(JSON.stringify(response.json())).not.toMatch(/forged|secret|synthetic/);
    expect(log).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("configuration gate", () => {
  it("requires dedicated Entra credentials and exact tenant issuer / public callback", () => {
    const original = { ...process.env };
    try {
      for (const key of [
        "ACTIVITY_OIDC_TENANT_ID",
        "ACTIVITY_OIDC_CLIENT_ID",
        "ACTIVITY_OIDC_CLIENT_SECRET",
        "ACTIVITY_OIDC_ISSUER",
        "ACTIVITY_OIDC_REDIRECT_URI",
      ])
        delete process.env[key];
      expect(activitySettings()).toBeNull();
      const tenant = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      process.env.ACTIVITY_OIDC_TENANT_ID = tenant;
      process.env.ACTIVITY_OIDC_CLIENT_ID = "app-id";
      process.env.ACTIVITY_OIDC_CLIENT_SECRET = "synthetic";
      process.env.ACTIVITY_OIDC_ISSUER = `https://login.microsoftonline.com/${tenant}/v2.0`;
      process.env.ACTIVITY_OIDC_REDIRECT_URI =
        "https://rtrda.or.th/api/analytics/activity-auth/callback";
      expect(activitySettings()).toMatchObject({ tenantId: tenant });
      process.env.ACTIVITY_OIDC_ISSUER = "https://login.microsoftonline.com/common/v2.0";
      expect(activitySettings()).toBeNull();
      process.env.ACTIVITY_OIDC_ISSUER = `https://login.microsoftonline.com/${tenant}/v2.0`;
      process.env.ACTIVITY_OIDC_REDIRECT_URI =
        "http://rtrda.or.th/api/analytics/activity-auth/callback";
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
});
