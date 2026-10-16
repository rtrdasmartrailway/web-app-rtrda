import { grantCoversDepartment } from "./client-grant-scope";

export type RequestEditCandidate = {
  requesterId: string;
  status?: string;
};

export function canEditOwnRequest(
  request: RequestEditCandidate,
  currentUserId: string,
): boolean {
  return (
    request.requesterId === currentUserId &&
    ["DRAFT", "SUBMITTED", "REJECTED", "WITHDRAWN"].includes(request.status || "")
  );
}

export function canAdminEditRequest(
  request: RequestEditCandidate & { departmentId?: string },
  grants: readonly { role: string; departmentId: string | null }[] | undefined,
): boolean {
  return (
    ["DRAFT", "SUBMITTED", "REJECTED", "WITHDRAWN"].includes(request.status || "") &&
    grantCoversDepartment(grants, ["RTRDA_ADMIN"], request.departmentId)
  );
}
