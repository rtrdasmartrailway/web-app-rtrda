import {
  getApprovalStage,
  type ApprovalPolicy,
  type ApprovalTaskRequirements,
} from "./approval-policy";
import { grantCoversDepartment } from "./client-grant-scope";

export function canDecideTaskStage(
  task: ApprovalTaskRequirements & { status: string; departmentId?: string },
  policy: ApprovalPolicy | null,
  grants: readonly { role: string; departmentId: string | null }[] | undefined,
): boolean {
  if (!policy) return false;
  const stage = getApprovalStage(policy, task.status.toUpperCase(), task);
  if (!stage) return false;
  // Organization-only stages cannot be widened by an unrelated global grant.
  return grantCoversDepartment(
    grants,
    stage.roles,
    stage.departmentScope === "ORGANIZATION" ? undefined : task.departmentId,
  );
}
