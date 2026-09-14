import { describe, expect, it, vi } from "vitest";
import { buildPrCenterApi, type EmailOnlyAuth, type EntraAuth } from "./app";

describe("OIDC callback failures", () => {
  it("revokes OIDC and temporary email sessions before returning to sign-in", async () => {
    const emailOnlyAuth: EmailOnlyAuth = {
      signIn: vi.fn(),
      signOut: vi.fn(() => "rtrda_pr_center_session=; Max-Age=0"),
    };
    const entraAuth: EntraAuth = {
      resolve: vi.fn(),
      begin: vi.fn(),
      callback: vi.fn().mockRejectedValue(new Error("token exchange failed")),
      signOut: vi.fn(() => ["rtrda_pr_center_oidc_session=; Max-Age=0"]),
    };
    const app = buildPrCenterApi(vi.fn(), emailOnlyAuth, entraAuth);

    const response = await app.inject({
      method: "GET",
      url: "/auth/callback?code=sensitive&state=sensitive",
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("/rtrdaintranet/prcenter?signin=failed");
    expect(response.headers["set-cookie"]).toContain(
      "rtrda_pr_center_oidc_session=; Max-Age=0",
    );
    expect(response.headers["set-cookie"]).toContain(
      "rtrda_pr_center_session=; Max-Age=0",
    );
    await app.close();
  });
});
