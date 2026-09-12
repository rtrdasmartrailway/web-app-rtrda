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

const WRITE_ROLES: PrCenterRole[] = ["PR_OPERATIONS", "SCOPED_ADMINISTRATOR"];

export function canManageTasks(role: PrCenterRole): boolean {
  return WRITE_ROLES.includes(role);
}

export function canTransitionTask(
  role: PrCenterRole,
  from: PrTaskStatus,
  to: PrTaskStatus,
): boolean {
  return WRITE_ROLES.includes(role) && TASK_TRANSITIONS[from].includes(to as never);
}

export function canApprove(role: PrCenterRole): boolean {
  return role === "APPROVER" || role === "SCOPED_ADMINISTRATOR";
}

export function canReadAllRequests(role: PrCenterRole): boolean {
  return role !== "REQUESTER";
}

export function canCreateRequest(role: PrCenterRole): boolean {
  return role === "REQUESTER" || role === "SCOPED_ADMINISTRATOR";
}

export function canCreateIdea(role: PrCenterRole): boolean {
  return (
    role === "REQUESTER" || role === "PR_OPERATIONS" || role === "SCOPED_ADMINISTRATOR"
  );
}

export function canReviewIdeas(role: PrCenterRole): boolean {
  return role === "PR_OPERATIONS" || role === "SCOPED_ADMINISTRATOR";
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
