export const PR_CENTER_ROLES = [
  "RTRDA_ALL_USER",
  "RTRDA_PR",
  "RTRDA_BORD",
  "RTRDA_ADMIN",
] as const;

export type PrCenterRole = (typeof PR_CENTER_ROLES)[number];

export const TASK_TRANSITIONS = {
  DRAFT: ["WAITING_FOR_INFORMATION", "COMMUNICATION_PLANNING", "CANCELLED"],
  WAITING_FOR_INFORMATION: ["COMMUNICATION_PLANNING", "CANCELLED"],
  COMMUNICATION_PLANNING: ["IN_PRODUCTION", "WAITING_FOR_INFORMATION", "CANCELLED"],
  IN_PRODUCTION: [
    "SOURCE_FACT_CHECK",
    "TECHNICAL_REVIEW",
    "PR_EDITORIAL_REVIEW",
    "REVISION_REQUIRED",
    "CANCELLED",
  ],
  SOURCE_FACT_CHECK: [
    "TECHNICAL_REVIEW",
    "PR_EDITORIAL_REVIEW",
    "REVISION_REQUIRED",
    "REJECTED",
  ],
  TECHNICAL_REVIEW: ["PR_EDITORIAL_REVIEW", "REVISION_REQUIRED", "REJECTED"],
  PR_EDITORIAL_REVIEW: [
    "MANAGEMENT_APPROVAL",
    "APPROVED",
    "REVISION_REQUIRED",
    "REJECTED",
  ],
  MANAGEMENT_APPROVAL: ["APPROVED", "REVISION_REQUIRED", "REJECTED"],
  REVISION_REQUIRED: [
    "IN_PRODUCTION",
    "SOURCE_FACT_CHECK",
    "TECHNICAL_REVIEW",
    "PR_EDITORIAL_REVIEW",
    "CANCELLED",
  ],
  APPROVED: ["SCHEDULED", "REVISION_REQUIRED", "CANCELLED"],
  SCHEDULED: ["PUBLISHED", "REVISION_REQUIRED", "CANCELLED"],
  PUBLISHED: ["CLOSED"],
  CLOSED: [],
  REJECTED: [],
  CANCELLED: [],
} as const;

export type PrTaskStatus = keyof typeof TASK_TRANSITIONS;

export type PrCenterRoleInput = PrCenterRole | readonly PrCenterRole[];

function includesAnyRole(
  input: PrCenterRoleInput,
  allowed: readonly PrCenterRole[],
): boolean {
  const roles = typeof input === "string" ? [input] : input;
  return roles.some((role) => allowed.includes(role));
}

const WRITE_ROLES: PrCenterRole[] = ["RTRDA_PR", "RTRDA_BORD", "RTRDA_ADMIN"];

export function canManageTasks(role: PrCenterRoleInput): boolean {
  return includesAnyRole(role, WRITE_ROLES);
}

export function canTransitionTask(
  role: PrCenterRoleInput,
  from: PrTaskStatus,
  to: PrTaskStatus,
): boolean {
  // Scheduling and publishing must pass the guarded publication commands.
  if (to === "SCHEDULED" || to === "PUBLISHED") return false;
  return canManageTasks(role) && TASK_TRANSITIONS[from].includes(to as never);
}

export function canApprove(role: PrCenterRoleInput): boolean {
  return includesAnyRole(role, ["RTRDA_PR", "RTRDA_BORD", "RTRDA_ADMIN"]);
}

export function canDecideRequestIntake(role: PrCenterRoleInput): boolean {
  return includesAnyRole(role, ["RTRDA_PR", "RTRDA_BORD", "RTRDA_ADMIN"]);
}

export function canReadAllRequests(role: PrCenterRoleInput): boolean {
  // PR, BORD, and ADMIN share cross-user request access within grant scope.
  return includesAnyRole(role, ["RTRDA_PR", "RTRDA_BORD", "RTRDA_ADMIN"]);
}

export function canCreateRequest(role: PrCenterRoleInput): boolean {
  return includesAnyRole(role, [
    "RTRDA_ALL_USER",
    "RTRDA_PR",
    "RTRDA_BORD",
    "RTRDA_ADMIN",
  ]);
}

export function canCreateIdea(role: PrCenterRoleInput): boolean {
  return includesAnyRole(role, [
    "RTRDA_ALL_USER",
    "RTRDA_PR",
    "RTRDA_BORD",
    "RTRDA_ADMIN",
  ]);
}

export function canReviewIdeas(role: PrCenterRoleInput): boolean {
  return includesAnyRole(role, ["RTRDA_PR", "RTRDA_BORD", "RTRDA_ADMIN"]);
}

export function canAttachFiles(role: PrCenterRoleInput): boolean {
  // Requesters can attach to their own requests; RTRDA_PR and admins
  // can attach to any request/task in scope.
  return includesAnyRole(role, [
    "RTRDA_ALL_USER",
    "RTRDA_PR",
    "RTRDA_BORD",
    "RTRDA_ADMIN",
  ]);
}

export function canRemoveAttachment(role: PrCenterRoleInput): boolean {
  return includesAnyRole(role, ["RTRDA_PR", "RTRDA_BORD", "RTRDA_ADMIN"]);
}

export function canAssignFinalAsset(role: PrCenterRoleInput): boolean {
  return includesAnyRole(role, ["RTRDA_PR", "RTRDA_BORD", "RTRDA_ADMIN"]);
}

export function canManageAccess(role: PrCenterRoleInput): boolean {
  return includesAnyRole(role, ["RTRDA_ADMIN"]);
}

export function canManageQuarantine(role: PrCenterRoleInput): boolean {
  return includesAnyRole(role, ["RTRDA_ADMIN", "RTRDA_PR", "RTRDA_BORD"]);
}

export function canExportAudit(role: PrCenterRoleInput): boolean {
  return includesAnyRole(role, ["RTRDA_ADMIN"]);
}

export function canRestoreRequests(role: PrCenterRoleInput): boolean {
  return includesAnyRole(role, ["RTRDA_ADMIN", "RTRDA_BORD"]);
}

export function publicationGate(input: {
  approved: boolean;
  ownerId: string | null;
  channel: string | null;
  hasSource: boolean;
  hasKeyMessage: boolean;
  hasCleanFinalAsset: boolean;
  scheduledFor: Date | null;
}): string[] {
  const missing: string[] = [];
  if (!input.approved) missing.push("approved revision");
  if (!input.ownerId) missing.push("owner");
  if (!input.channel) missing.push("channel");
  if (!input.hasSource) missing.push("source");
  if (!input.hasKeyMessage) missing.push("key message");
  if (!input.hasCleanFinalAsset) missing.push("clean final asset");
  if (!input.scheduledFor) missing.push("schedule");
  return missing;
}
