export type PrCenterSession = {
  userId: string;
  displayName: string;
  departmentName: string;
  isRootAdministrator: boolean;
  role: "RTRDA_ALL_USER" | "RTRDA_PR" | "RTRDA_BORD" | "RTRDA_ADMIN";
  roles: Array<"RTRDA_ALL_USER" | "RTRDA_PR" | "RTRDA_BORD" | "RTRDA_ADMIN">;
  roleGrants: Array<{
    role: "RTRDA_ALL_USER" | "RTRDA_PR" | "RTRDA_BORD" | "RTRDA_ADMIN";
    departmentId: string | null;
  }>;
};

export type PrCenterSessionResult =
  | { state: "authenticated"; session: PrCenterSession }
  | { state: "sign-in-required" | "unavailable"; session: null };

export async function fetchCurrentPrCenterSession(
  fetcher: typeof fetch = fetch,
): Promise<PrCenterSessionResult> {
  try {
    const response = await fetcher("/api/pr-center/session", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok)
      return {
        state: response.status === 401 ? "sign-in-required" : "unavailable",
        session: null,
      };
    return {
      state: "authenticated",
      session: (await response.json()) as PrCenterSession,
    };
  } catch {
    return { state: "unavailable", session: null };
  }
}
