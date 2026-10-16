import { grantCoversDepartment } from "./client-grant-scope";

export function canRestoreRequestInUi(
  grants: readonly { role: string; departmentId: string | null }[] | undefined,
  request: { departmentId?: string; status?: string; version?: number },
): boolean {
  return (
    (request.status === "WITHDRAWN" || request.status === "CANCELLED") &&
    Number.isSafeInteger(request.version) &&
    (request.version ?? 0) > 0 &&
    grantCoversDepartment(grants, ["RTRDA_BORD", "RTRDA_ADMIN"], request.departmentId)
  );
}
