export type PrCenterSession = {
  userId: string;
  displayName: string;
  departmentName: string;
  isRootAdministrator: boolean;
  role:
    | "REQUESTER"
    | "PR_OPERATIONS"
    | "APPROVER"
    | "EXECUTIVE_READ_ONLY"
    | "SCOPED_ADMINISTRATOR";
  roles: Array<
    | "REQUESTER"
    | "PR_OPERATIONS"
    | "APPROVER"
    | "EXECUTIVE_READ_ONLY"
    | "SCOPED_ADMINISTRATOR"
  >;
  roleGrants: Array<{
    role:
      | "REQUESTER"
      | "PR_OPERATIONS"
      | "APPROVER"
      | "EXECUTIVE_READ_ONLY"
      | "SCOPED_ADMINISTRATOR";
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
