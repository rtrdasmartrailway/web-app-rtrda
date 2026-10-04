export const PR_CENTER_ROLES = [
  "REQUESTER",
  "PR_OPERATIONS",
  "APPROVER",
  "EXECUTIVE_READ_ONLY",
  "SCOPED_ADMINISTRATOR",
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

const WRITE_ROLES: PrCenterRole[] = ["PR_OPERATIONS", "SCOPED_ADMINISTRATOR"];

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
  // Approval authority is restricted to PR operations and scoped administrators.
  return includesAnyRole(role, ["PR_OPERATIONS", "SCOPED_ADMINISTRATOR"]);
}

export function canDecideRequestIntake(role: PrCenterRoleInput): boolean {
  return includesAnyRole(role, ["PR_OPERATIONS"]);
}

export function canReadAllRequests(role: PrCenterRoleInput): boolean {
  return includesAnyRole(role, ["PR_OPERATIONS"]);
}

export function canCreateRequest(role: PrCenterRoleInput): boolean {
  return includesAnyRole(role, ["REQUESTER", "SCOPED_ADMINISTRATOR"]);
}

export function canCreateIdea(role: PrCenterRoleInput): boolean {
  return includesAnyRole(role, ["REQUESTER", "PR_OPERATIONS", "SCOPED_ADMINISTRATOR"]);
}

export function canReviewIdeas(role: PrCenterRoleInput): boolean {
  return includesAnyRole(role, ["PR_OPERATIONS", "SCOPED_ADMINISTRATOR"]);
}

export function canAttachFiles(role: PrCenterRoleInput): boolean {
  // Requesters can attach to their own requests; PR_OPERATIONS and admins
  // can attach to any request/task in scope.
  return includesAnyRole(role, [
    "REQUESTER",
    "PR_OPERATIONS",
    "APPROVER",
    "SCOPED_ADMINISTRATOR",
  ]);
}

export function canRemoveAttachment(role: PrCenterRoleInput): boolean {
  return includesAnyRole(role, ["PR_OPERATIONS", "SCOPED_ADMINISTRATOR"]);
}

export function canAssignFinalAsset(role: PrCenterRoleInput): boolean {
  return includesAnyRole(role, ["PR_OPERATIONS", "SCOPED_ADMINISTRATOR"]);
}

export function canManageAccess(role: PrCenterRoleInput): boolean {
  return includesAnyRole(role, ["SCOPED_ADMINISTRATOR"]);
}

export function canManageQuarantine(role: PrCenterRoleInput): boolean {
  return includesAnyRole(role, ["SCOPED_ADMINISTRATOR", "PR_OPERATIONS"]);
}

export function canExportAudit(role: PrCenterRoleInput): boolean {
  return includesAnyRole(role, ["SCOPED_ADMINISTRATOR"]);
}

export function canRestoreRequests(role: PrCenterRoleInput): boolean {
  return includesAnyRole(role, ["SCOPED_ADMINISTRATOR"]);
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
