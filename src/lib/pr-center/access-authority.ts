export const ROOT_PR_CENTER_ADMIN_EMAIL = "admin@apprtrda.onmicrosoft.com";

export function isRootPrCenterAdministrator(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === ROOT_PR_CENTER_ADMIN_EMAIL;
}
