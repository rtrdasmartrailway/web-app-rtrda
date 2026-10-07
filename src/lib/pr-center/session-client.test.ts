import { describe, expect, it, vi } from "vitest";
import { fetchCurrentPrCenterSession, type PrCenterSession } from "./session-client";

const session: PrCenterSession = {
  userId: "user-1",
  displayName: "Test User",
  departmentName: "Communications",
  isRootAdministrator: false,
  role: "PR_OPERATIONS",
  roles: ["REQUESTER", "PR_OPERATIONS"],
  roleGrants: [
    { role: "PR_OPERATIONS", departmentId: "dept-1" },
    { role: "REQUESTER", departmentId: null },
  ],
};

describe("fetchCurrentPrCenterSession", () => {
  it("returns the current authenticated profile and uses same-origin credentials", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(session), { status: 200 }));

    await expect(fetchCurrentPrCenterSession(fetcher)).resolves.toEqual({
      state: "authenticated",
      session,
    });
    expect(fetcher).toHaveBeenCalledWith("/api/pr-center/session", {
      credentials: "same-origin",
      cache: "no-store",
    });
  });

  it("requires sign-in when the server rejects the session", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 401 }));

    await expect(fetchCurrentPrCenterSession(fetcher)).resolves.toEqual({
      state: "sign-in-required",
      session: null,
    });
  });

  it("fails closed when session validation is unavailable", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));

    await expect(fetchCurrentPrCenterSession(fetcher)).resolves.toEqual({
      state: "unavailable",
      session: null,
    });
  });

  it("fails closed on a network error", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("network unavailable"));

    await expect(fetchCurrentPrCenterSession(fetcher)).resolves.toEqual({
      state: "unavailable",
      session: null,
    });
  });
});
