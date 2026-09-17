import { describe, expect, it, vi } from "vitest";
import { buildPrCenterApi, type EntraAuth } from "./app";

describe("OIDC callback failures", () => {
  it("revokes the OIDC session before returning to sign-in", async () => {
    const entraAuth: EntraAuth = {
      resolve: vi.fn(),
      begin: vi.fn(),
      callback: vi.fn().mockRejectedValue(new Error("token exchange failed")),
      signOut: vi.fn(() => ["rtrda_pr_center_oidc_session=; Max-Age=0"]),
    };
    const app = buildPrCenterApi(vi.fn(), entraAuth);

    const response = await app.inject({
      method: "GET",
      url: "/auth/callback?code=sensitive&state=sensitive",
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("/rtrdaintranet/prcenter?signin=failed");
    expect(response.headers["set-cookie"]).toContain(
      "rtrda_pr_center_oidc_session=; Max-Age=0",
    );
    await app.close();
  });
});
