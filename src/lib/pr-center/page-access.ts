import type { PrCenterRole } from "./workflow";

const CORE_PAGES = new Set([
  "system-data",
  "executive",
  "home",
  "new-request",
  "my-requests",
  "requests",
  "operations",
  "calendar",
  "approvals",
  "notifications",
  "history",
  "directory",
  "settings",
  "help",
]);
const OPTIONAL_PAGES = new Set(["library", "ideas", "message-house"]);
export const REQUESTER_PAGE_IDS = [
  "home",
  "new-request",
  "my-requests",
  "operations",
  "calendar",
  "ideas",
  "message-house",
  "notifications",
  "help",
] as const;
const REQUESTER_PAGES = new Set<string>(REQUESTER_PAGE_IDS);

export function isPrCenterPageEnabled(page: string, phase2Pages = ""): boolean {
  return (
    CORE_PAGES.has(page) ||
    (OPTIONAL_PAGES.has(page) &&
      phase2Pages.split(",").some((value) => value.trim() === page))
  );
}

export function canOpenPrCenterPage(
  page: string,
  roles: readonly PrCenterRole[],
  phase2Pages = "",
): boolean {
  if (!isPrCenterPageEnabled(page, phase2Pages)) return false;
  if (page === "system-data" || page === "executive")
    return roles.includes("RTRDA_ADMIN");
  return roles.some((role) =>
    role === "RTRDA_ALL_USER"
      ? REQUESTER_PAGES.has(page)
      : ["RTRDA_PR", "RTRDA_BORD", "RTRDA_ADMIN"].includes(role),
  );
}
