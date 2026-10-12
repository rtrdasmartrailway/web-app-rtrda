import { PR_CENTER_ROLES, type PrCenterRole } from "./workflow";

export const APPROVAL_STAGE_STATUSES = [
  "SOURCE_FACT_CHECK",
  "TECHNICAL_REVIEW",
  "PR_EDITORIAL_REVIEW",
  "MANAGEMENT_APPROVAL",
] as const;

export type ApprovalStageStatus = (typeof APPROVAL_STAGE_STATUSES)[number];
export type ApprovalDepartmentScope = "TASK_DEPARTMENT" | "ORGANIZATION";

export type ApprovalStageCondition =
  | "TECHNICAL_REVIEW_REQUIRED"
  | "MANAGEMENT_APPROVAL_REQUIRED";

export type ApprovalTaskRequirements = {
  technicalReviewRequired?: boolean;
  managementApprovalRequired?: boolean;
};

export type ApprovalPolicyStage = {
  status: ApprovalStageStatus;
  required: boolean;
  roles: PrCenterRole[];
  departmentScope: ApprovalDepartmentScope;
  condition?: ApprovalStageCondition;
};

export type ApprovalPolicy = {
  version: string;
  approvalReference: string;
  effectiveAt: string;
  stages: ApprovalPolicyStage[];
};

const APPROVER_ROLES: PrCenterRole[] = ["RTRDA_PR", "RTRDA_BORD", "RTRDA_ADMIN"];
const CONDITIONS: Readonly<Record<ApprovalStageStatus, ApprovalStageCondition[]>> = {
  SOURCE_FACT_CHECK: [],
  TECHNICAL_REVIEW: ["TECHNICAL_REVIEW_REQUIRED"],
  PR_EDITORIAL_REVIEW: [],
  MANAGEMENT_APPROVAL: ["MANAGEMENT_APPROVAL_REQUIRED"],
};
const TOP_LEVEL_KEYS = new Set(["version", "approvalReference", "effectiveAt", "stages"]);
const STAGE_KEYS = new Set([
  "status",
  "required",
  "roles",
  "departmentScope",
  "condition",
]);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknownKeys(value: Record<string, unknown>, allowed: Set<string>) {
  if (Object.keys(value).some((key) => !allowed.has(key)))
    throw new Error("Approval policy contains unsupported fields");
}

export function parseApprovalPolicy(
  raw: string | undefined,
  now = new Date(),
): ApprovalPolicy {
  if (!raw?.trim()) throw new Error("Organization approval policy is not configured");

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Organization approval policy is not valid JSON");
  }
  if (!record(value)) throw new Error("Organization approval policy must be an object");
  rejectUnknownKeys(value, TOP_LEVEL_KEYS);

  const version = value.version;
  const approvalReference = value.approvalReference;
  const effectiveAt = value.effectiveAt;
  if (typeof version !== "string" || !version.trim() || version.length > 100)
    throw new Error("Approval policy version is required");
  if (
    typeof approvalReference !== "string" ||
    !approvalReference.trim() ||
    approvalReference.length > 200
  )
    throw new Error("Owner approval reference is required");
  if (typeof effectiveAt !== "string" || !Number.isFinite(Date.parse(effectiveAt)))
    throw new Error("Approval policy effectiveAt must be an ISO date");
  if (Date.parse(effectiveAt) > now.getTime())
    throw new Error("Organization approval policy is not effective yet");
  if (!Array.isArray(value.stages) || value.stages.length === 0)
    throw new Error("Approval policy must define at least one stage");

  const seen = new Set<string>();
  const stages = value.stages.map((stage): ApprovalPolicyStage => {
    if (!record(stage)) throw new Error("Approval policy stage must be an object");
    rejectUnknownKeys(stage, STAGE_KEYS);
    if (
      typeof stage.status !== "string" ||
      !APPROVAL_STAGE_STATUSES.includes(stage.status as ApprovalStageStatus) ||
      seen.has(stage.status)
    )
      throw new Error("Approval policy stage status is invalid or duplicated");
    seen.add(stage.status);
    if (typeof stage.required !== "boolean")
      throw new Error("Approval policy stage required must be boolean");
    if (
      !Array.isArray(stage.roles) ||
      stage.roles.length === 0 ||
      stage.roles.some(
        (role) =>
          typeof role !== "string" ||
          !PR_CENTER_ROLES.includes(role as PrCenterRole) ||
          !APPROVER_ROLES.includes(role as PrCenterRole),
      )
    )
      throw new Error("Approval policy stage roles must be valid approver roles");
    if (
      stage.departmentScope !== "TASK_DEPARTMENT" &&
      stage.departmentScope !== "ORGANIZATION"
    )
      throw new Error("Approval policy stage departmentScope is invalid");
    const condition = stage.condition;
    if (
      condition !== undefined &&
      (typeof condition !== "string" ||
        !CONDITIONS[stage.status as ApprovalStageStatus].includes(
          condition as ApprovalStageCondition,
        ))
    )
      throw new Error("Approval policy stage condition is invalid for this status");
    return {
      status: stage.status as ApprovalStageStatus,
      required: stage.required,
      roles: [...new Set(stage.roles as PrCenterRole[])],
      departmentScope: stage.departmentScope,
      ...(condition ? { condition: condition as ApprovalStageCondition } : {}),
    };
  });

  if (!stages.some((stage) => stage.required))
    throw new Error("Approval policy must include a required approval stage");

  const stageFor = (status: ApprovalStageStatus) =>
    stages.find((stage) => stage.status === status);
  const requiredStage = (
    status: ApprovalStageStatus,
    condition?: ApprovalStageCondition,
  ) => {
    const stage = stageFor(status);
    if (!stage?.required || stage.condition !== condition)
      throw new Error(
        `Approval policy must require ${status} with its approved condition`,
      );
    return stage;
  };
  requiredStage("SOURCE_FACT_CHECK");
  const technicalStage = requiredStage("TECHNICAL_REVIEW", "TECHNICAL_REVIEW_REQUIRED");
  const editorialStage = requiredStage("PR_EDITORIAL_REVIEW");
  const managementStage = requiredStage(
    "MANAGEMENT_APPROVAL",
    "MANAGEMENT_APPROVAL_REQUIRED",
  );
  const hasExactRoles = (stage: ApprovalPolicyStage, roles: PrCenterRole[]) =>
    stage.roles.length === roles.length &&
    roles.every((role) => stage.roles.includes(role));
  if (!hasExactRoles(technicalStage, ["RTRDA_PR", "RTRDA_BORD"]))
    throw new Error("Technical review must be assigned to PR and BORD");
  if (!hasExactRoles(editorialStage, ["RTRDA_PR"]))
    throw new Error("PR editorial review must be assigned to PR only");
  if (!hasExactRoles(managementStage, ["RTRDA_BORD"]))
    throw new Error("Management approval must be assigned to BORD only");

  return { version, approvalReference, effectiveAt, stages };
}

export function isApprovalStageRequired(
  stage: ApprovalPolicyStage,
  requirements: ApprovalTaskRequirements = {},
): boolean {
  if (!stage.required) return false;
  if (stage.condition === "TECHNICAL_REVIEW_REQUIRED")
    return requirements.technicalReviewRequired === true;
  if (stage.condition === "MANAGEMENT_APPROVAL_REQUIRED")
    return requirements.managementApprovalRequired === true;
  return true;
}

export function getApprovalStage(
  policy: ApprovalPolicy,
  status: string,
  requirements: ApprovalTaskRequirements = {},
): ApprovalPolicyStage | null {
  return (
    policy.stages.find(
      (stage) => stage.status === status && isApprovalStageRequired(stage, requirements),
    ) ?? null
  );
}

export function getFirstApprovalStage(
  policy: ApprovalPolicy,
  requirements: ApprovalTaskRequirements = {},
): ApprovalPolicyStage {
  const first = policy.stages.find((stage) =>
    isApprovalStageRequired(stage, requirements),
  );
  if (!first) throw new Error("Approval policy has no required stage for this task");
  return first;
}

export function getNextApprovalStage(
  policy: ApprovalPolicy,
  currentStatus: ApprovalStageStatus,
  requirements: ApprovalTaskRequirements = {},
): ApprovalPolicyStage | null {
  const currentIndex = policy.stages.findIndex(
    (stage) =>
      stage.status === currentStatus && isApprovalStageRequired(stage, requirements),
  );
  if (currentIndex < 0) return null;
  return (
    policy.stages
      .slice(currentIndex + 1)
      .find((stage) => isApprovalStageRequired(stage, requirements)) ?? null
  );
}

export function hasApprovalAuthority(input: {
  stage: ApprovalPolicyStage;
  roleGrants: ReadonlyArray<{ role: PrCenterRole; departmentId: string | null }>;
  taskDepartmentId: string | null;
}): boolean {
  return input.roleGrants.some((grant) => {
    if (!input.stage.roles.includes(grant.role)) return false;
    if (grant.departmentId === null) return true;
    if (input.stage.departmentScope === "ORGANIZATION") return false;
    return grant.departmentId === input.taskDepartmentId;
  });
}
