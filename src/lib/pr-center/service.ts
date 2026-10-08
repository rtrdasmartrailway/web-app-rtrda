import { randomUUID } from "node:crypto";
import {
  Prisma,
  type PrContentIdeaStatus,
  type PrApprovalDecision,
  type PrRequestStatus,
  type PrTaskStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import {
  canApprove,
  canDecideRequestIntake,
  canCreateRequest,
  canCreateIdea,
  canManageTasks,
  canReadAllRequests,
  canReviewIdeas,
  canTransitionTask,
  canAttachFiles,
  canRemoveAttachment,
  canAssignFinalAsset,
  canManageAccess,
  canManageQuarantine,
  canRestoreRequests,
  publicationGate,
  type PrCenterRole,
  type PrTaskStatus as WorkflowStatus,
  PR_CENTER_ROLES,
} from "./workflow";
import {
  APPROVAL_STAGE_STATUSES,
  getApprovalStage,
  getFirstApprovalStage,
  getNextApprovalStage,
  hasApprovalAuthority,
  parseApprovalPolicy,
} from "./approval-policy";
import { isClamAvAvailable, scanWithClamAv } from "./clamav-scanner";
import {
  storeFile,
  readFileFromStorage,
  removeFileFromStorage,
  FileValidationError,
  type StoredFile,
} from "./file-storage";
import {
  evaluateNotificationPolicy,
  prefixedTitle,
  type PolicyEvaluationResult,
} from "./notification-policy";
import { dispatchNotification } from "./notification-channels";
import { normalizeCreateIdeaInput } from "./idea-input";
import { isRootPrCenterAdministrator } from "./access-authority";
import {
  latestReleaseEvidenceByGate,
  parseReleaseEvidenceInput,
  RELEASE_EVIDENCE_GATES,
  type ReleaseEvidenceGate,
} from "./release-evidence";

export type PrCenterActor = {
  id: string;
  organizationId: string;
  departmentId: string | null;
  /** Display/legacy role only. Authorization must use every role grant below. */
  role: PrCenterRole;
  roleGrants?: PrCenterRoleGrant[];
  /** Legacy single-grant scope for service tests and older internal callers. */
  scopeDepartmentId?: string | null;
  /** Root identity can grant/revoke SCOPED_ADMINISTRATOR assignments. */
  isRootAdministrator?: boolean;
};

export type PrCenterRoleGrant = {
  role: PrCenterRole;
  /** null is organization-wide; a string limits the grant to that department. */
  departmentId: string | null;
};

function actorRoleGrants(actor: PrCenterActor): PrCenterRoleGrant[] {
  if (actor.roleGrants?.length) return actor.roleGrants;
  return [
    {
      role: actor.role,
      departmentId:
        actor.scopeDepartmentId !== undefined
          ? actor.scopeDepartmentId
          : actor.role === "SCOPED_ADMINISTRATOR"
            ? null
            : actor.departmentId,
    },
  ];
}

function actorRoles(actor: PrCenterActor): PrCenterRole[] {
  return [...new Set(actorRoleGrants(actor).map((grant) => grant.role))];
}

function actorHasRole(actor: PrCenterActor, role: PrCenterRole): boolean {
  return actorRoleGrants(actor).some((grant) => grant.role === role);
}

function canAccessIdeaReview(actor: PrCenterActor): boolean {
  return ["PR_OPERATIONS", "APPROVER", "SCOPED_ADMINISTRATOR"].some((role) =>
    actorHasRole(actor, role as PrCenterRole),
  );
}

function actorHasOrganizationWideRole(
  actor: PrCenterActor,
  roles: readonly PrCenterRole[],
): boolean {
  return actorRoleGrants(actor).some(
    (grant) => roles.includes(grant.role) && grant.departmentId === null,
  );
}

function canManageDepartmentScope(
  actor: PrCenterActor,
  departmentId: string | null,
): boolean {
  const administratorGrants = actorRoleGrants(actor).filter(
    (grant) => grant.role === "SCOPED_ADMINISTRATOR",
  );
  return administratorGrants.some(
    (grant) =>
      grant.departmentId === null ||
      (departmentId !== null && grant.departmentId === departmentId),
  );
}

function assertCanManageDepartmentScope(
  actor: PrCenterActor,
  departmentId: string | null,
) {
  if (!canManageDepartmentScope(actor, departmentId))
    throw new PrCenterError(
      "Requested department is outside your administrator scope",
      403,
      "FORBIDDEN",
    );
}

function assertCanManageUserScope(
  actor: PrCenterActor,
  user: { departmentId: string | null },
) {
  assertCanManageDepartmentScope(actor, user.departmentId);
}

function roleDepartmentScopes(
  actor: PrCenterActor,
  roles: readonly PrCenterRole[],
): { organizationWide: boolean; departmentIds: string[] } {
  const grants = actorRoleGrants(actor).filter(
    (grant) => roles.includes(grant.role) && grant.role !== "REQUESTER",
  );
  const organizationWide = grants.some((grant) => grant.departmentId === null);
  const departmentIds = [
    ...new Set(
      grants.flatMap((grant) => (grant.departmentId ? [grant.departmentId] : [])),
    ),
  ];
  return { organizationWide, departmentIds };
}

function roleDepartmentClauses(
  actor: PrCenterActor,
  roles: readonly PrCenterRole[],
): Array<{ departmentId?: string }> {
  const scopes = roleDepartmentScopes(actor, roles);
  if (scopes.organizationWide) return [{}];
  return scopes.departmentIds.map((departmentId) => ({ departmentId }));
}

function requestScopeWhere(actor: PrCenterActor): Prisma.PrRequestWhereInput {
  const clauses: Prisma.PrRequestWhereInput[] = [];
  if (actorHasRole(actor, "REQUESTER")) clauses.push({ requesterId: actor.id });
  clauses.push(
    ...roleDepartmentClauses(actor, [
      "PR_OPERATIONS",
      "APPROVER",
      "SCOPED_ADMINISTRATOR",
    ]),
  );
  return { organizationId: actor.organizationId, OR: clauses };
}

function requestReadWhere(actor: PrCenterActor): Prisma.PrRequestWhereInput {
  const roleScopes = roleDepartmentClauses(actor, [
    "PR_OPERATIONS",
    "SCOPED_ADMINISTRATOR",
  ]);
  if (roleScopes.some((scope) => Object.keys(scope).length === 0))
    return { organizationId: actor.organizationId };
  const clauses: Prisma.PrRequestWhereInput[] = [{ requesterId: actor.id }];
  clauses.push(...roleScopes);
  return { organizationId: actor.organizationId, OR: clauses };
}

function canReadRequestRecord(
  actor: PrCenterActor,
  request: { organizationId: string; departmentId: string; requesterId: string },
): boolean {
  if (request.organizationId !== actor.organizationId) return false;
  if (request.requesterId === actor.id) return true;
  const scope = roleDepartmentScopes(actor, ["PR_OPERATIONS"]);
  return scope.organizationWide || scope.departmentIds.includes(request.departmentId);
}

function quarantinedFileScope(actor: PrCenterActor): {
  fileWhere: Prisma.PrFileObjectWhereInput;
  attachmentWhere?: Prisma.PrAttachmentWhereInput;
} {
  const scope = roleDepartmentScopes(actor, ["PR_OPERATIONS", "SCOPED_ADMINISTRATOR"]);
  if (scope.organizationWide) return { fileWhere: {} };
  if (scope.departmentIds.length === 0) return { fileWhere: { id: "__out_of_scope__" } };
  const requestScope: Prisma.PrRequestWhereInput = {
    organizationId: actor.organizationId,
    departmentId: { in: scope.departmentIds },
  };
  const attachmentWhere: Prisma.PrAttachmentWhereInput = {
    OR: [
      { request: { is: requestScope } },
      { task: { is: { request: { is: requestScope } } } },
    ],
  };
  return {
    fileWhere: { attachments: { some: attachmentWhere, every: attachmentWhere } },
    attachmentWhere,
  };
}

function ideaScopeWhere(
  actor: PrCenterActor,
  ideaId: string,
): Prisma.PrContentIdeaWhereInput {
  const reviewerScopes = roleDepartmentClauses(actor, [
    "PR_OPERATIONS",
    "APPROVER",
    "SCOPED_ADMINISTRATOR",
  ]);
  const clauses: Prisma.PrContentIdeaWhereInput[] = canAccessIdeaReview(actor)
    ? reviewerScopes.map((scope) => scope)
    : [{ proposerId: actor.id }];
  return {
    id: ideaId,
    organizationId: actor.organizationId,
    OR: clauses,
  };
}

function ideaCommentScopeWhere(
  actor: PrCenterActor,
  ideaId: string,
): Prisma.PrContentIdeaWhereInput {
  const scopes: Prisma.PrContentIdeaWhereInput[] = [{ proposerId: actor.id }];
  if (canAccessIdeaReview(actor))
    scopes.push(
      ...roleDepartmentClauses(actor, [
        "PR_OPERATIONS",
        "APPROVER",
        "SCOPED_ADMINISTRATOR",
      ]),
    );
  return { id: ideaId, organizationId: actor.organizationId, OR: scopes };
}

function taskScopeWhere(actor: PrCenterActor, taskId: string): Prisma.PrTaskWhereInput {
  return { id: taskId, request: requestScopeWhere(actor) };
}

export class PrCenterError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export async function sessionProfile(actor: PrCenterActor) {
  const user = await prisma.prCenterUser.findFirst({
    where: { id: actor.id, organizationId: actor.organizationId, active: true },
    include: { department: { select: { name: true } } },
  });
  if (!user)
    throw new PrCenterError("Your account is no longer active", 401, "UNAUTHENTICATED");
  return {
    userId: actor.id,
    organizationId: actor.organizationId,
    departmentId: actor.departmentId,
    displayName: user.displayName,
    isRootAdministrator: isRootPrCenterAdministrator(user.email),
    departmentName: user.department?.name || "",
    role: actor.role,
    roles: actorRoles(actor),
    roleGrants: actorRoleGrants(actor),
  };
}

type CreateRequestInput = {
  type: "PR" | "OFFSITE";
  title: string;
  objective?: string;
  audience?: string;
  requestedFor?: Date;
  sourceUrls: string[];
  priority?: string;
  priorityReason?: string;
  offsiteDetails?: { startTime: string; endTime?: string; travel: string };
  requestDetails?: {
    projectOwner: string;
    assigner: string;
    whyNow: string;
    contentTypes: string[];
    priorityReason: string;
    projectDetails: string;
    confirmed: boolean;
  };
};

const REQUEST_CONTENT_TYPES = new Set([
  "Website News",
  "Facebook Post",
  "Carousel",
  "Infographic",
  "Quote Card",
  "Short Video",
  "Reel",
  "YouTube Video",
  "Photo Album",
  "X Post",
  "LinkedIn Post",
  "Press Release",
  "Newsletter",
  "Executive Brief",
  "Other",
]);

function validatedPriority(value?: string) {
  const priority = value?.trim().toUpperCase() || "NORMAL";
  if (!["LOW", "NORMAL", "HIGH", "URGENT"].includes(priority))
    throw new PrCenterError("Unknown request priority", 422, "INVALID_PRIORITY");
  return priority;
}

function validateOffsiteDetails(
  type: CreateRequestInput["type"],
  details: CreateRequestInput["offsiteDetails"],
  requireEndTime = false,
) {
  if (type !== "OFFSITE") return undefined;
  const startTime = details?.startTime?.trim() || "";
  const endTime = details?.endTime?.trim() || "";
  const travel = details?.travel?.trim() || "";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime))
    throw new PrCenterError(
      "A valid off-site start time is required",
      422,
      "INVALID_OFFSITE_DETAILS",
    );
  if (!travel || travel.length > 200)
    throw new PrCenterError(
      "Travel arrangement is required",
      422,
      "INVALID_OFFSITE_DETAILS",
    );
  if (endTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime))
    throw new PrCenterError(
      "A valid off-site end time is required",
      422,
      "INVALID_OFFSITE_DETAILS",
    );
  if (requireEndTime && !endTime)
    throw new PrCenterError(
      "A valid off-site end time is required",
      422,
      "INVALID_OFFSITE_DETAILS",
    );
  if (endTime && endTime <= startTime)
    throw new PrCenterError(
      "Off-site end time must be after the start time",
      422,
      "INVALID_OFFSITE_DETAILS",
    );
  return { startTime, ...(endTime ? { endTime } : {}), travel };
}

function validateRequestDetails(
  type: CreateRequestInput["type"],
  details: CreateRequestInput["requestDetails"],
) {
  if (!details) return undefined;
  const projectOwner = details.projectOwner.trim();
  const assigner = details.assigner.trim();
  const whyNow = details.whyNow.trim();
  const contentTypes = [
    ...new Set(details.contentTypes.map((item) => item.trim()).filter(Boolean)),
  ];
  const projectDetails = details.projectDetails.trim();
  const priorityReason = details.priorityReason.trim();
  if (!projectOwner || !assigner || !details.confirmed)
    throw new PrCenterError(
      "Project owner, assigner, and source confirmation are required",
      422,
      "INVALID_REQUEST_DETAILS",
    );
  if (type === "PR" && (!whyNow || contentTypes.length === 0))
    throw new PrCenterError(
      "Why-now and at least one content type are required for PR requests",
      422,
      "INVALID_REQUEST_DETAILS",
    );
  if (contentTypes.some((item) => !REQUEST_CONTENT_TYPES.has(item)))
    throw new PrCenterError(
      "One or more content types are not supported",
      422,
      "INVALID_REQUEST_DETAILS",
    );
  if (
    projectOwner.length > 200 ||
    assigner.length > 200 ||
    whyNow.length > 5000 ||
    priorityReason.length > 1000 ||
    projectDetails.length > 5000
  )
    throw new PrCenterError(
      "Request details exceed the allowed length",
      422,
      "INVALID_REQUEST_DETAILS",
    );
  return {
    projectOwner,
    assigner,
    whyNow,
    contentTypes,
    priorityReason,
    projectDetails,
    confirmed: details.confirmed,
  };
}

const DEFAULT_PR_MASTER_DATA = {
  channels: [
    "Website",
    "Facebook",
    "TikTok",
    "YouTube",
    "X",
    "LinkedIn",
    "Press Release",
    "Internal",
  ],
  contentTypes: [
    "Website News",
    "Facebook Post",
    "Carousel",
    "Infographic",
    "Quote Card",
    "Short Video",
    "Reel",
    "YouTube Video",
    "Photo Album",
    "X Post",
    "LinkedIn Post",
    "Press Release",
    "Newsletter",
    "Executive Brief",
    "Other",
  ],
  contentPillars: [
    "P01 Rail Explained",
    "P02 Behind the Standard",
    "P03 Behind Every Safe Journey",
    "P04 Human(s) of RTRDA",
    "P05 Research to Reality",
    "P06 Ask RTRDA",
    "P07 Future Rail Thailand",
    "P08 National Impact",
  ],
};

function normalizeMasterDataList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100)
    throw new PrCenterError(
      `${field} must contain 1 to 100 values`,
      422,
      "INVALID_MASTER_DATA",
    );
  const normalized = [
    ...new Set(
      value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean),
    ),
  ];
  if (normalized.length === 0 || normalized.some((item) => item.length > 200))
    throw new PrCenterError(
      `${field} values must be 1 to 200 characters`,
      422,
      "INVALID_MASTER_DATA",
    );
  return normalized;
}

export async function getPrMasterData(actor: PrCenterActor) {
  const [setting, departments] = await Promise.all([
    prisma.prOrganizationSetting.findUnique({
      where: {
        organizationId_key: {
          organizationId: actor.organizationId,
          key: "pr-master-data",
        },
      },
    }),
    prisma.prDepartment.findMany({
      where: { organizationId: actor.organizationId, active: true },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);
  const value =
    setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value)
      ? (setting.value as Record<string, unknown>)
      : {};
  const storedList = (key: keyof typeof DEFAULT_PR_MASTER_DATA) => {
    const raw = value[key];
    return Array.isArray(raw) && raw.every((item) => typeof item === "string")
      ? normalizeMasterDataList(raw, key)
      : DEFAULT_PR_MASTER_DATA[key];
  };
  return {
    ...DEFAULT_PR_MASTER_DATA,
    channels: storedList("channels"),
    contentTypes: storedList("contentTypes"),
    contentPillars: storedList("contentPillars"),
    departments: departments.map((department) => department.name),
    approvalStages: [
      "Source fact check",
      "Technical review",
      "PR editorial review",
      "Management approval",
    ],
  };
}

export async function savePrMasterData(
  actor: PrCenterActor,
  input: unknown,
  correlationId: string = randomUUID(),
) {
  if (!actorHasOrganizationWideRole(actor, ["SCOPED_ADMINISTRATOR"]))
    throw new PrCenterError(
      "Organization-wide administrator role is required",
      403,
      "FORBIDDEN",
    );
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new PrCenterError("Master data is required", 422, "INVALID_MASTER_DATA");
  const value = input as Record<string, unknown>;
  const masterData = {
    channels: normalizeMasterDataList(value.channels, "channels"),
    contentTypes: normalizeMasterDataList(value.contentTypes, "contentTypes"),
    contentPillars: normalizeMasterDataList(value.contentPillars, "contentPillars"),
  };
  return prisma.$transaction(async (tx) => {
    const saved = await tx.prOrganizationSetting.upsert({
      where: {
        organizationId_key: {
          organizationId: actor.organizationId,
          key: "pr-master-data",
        },
      },
      create: {
        organizationId: actor.organizationId,
        key: "pr-master-data",
        value: masterData,
      },
      update: { value: masterData },
    });
    await auditAndOutbox(tx, {
      actor,
      action: "pr.master_data.updated",
      entityType: "master_data",
      entityId: saved.id,
      after: masterData,
      eventType: "pr.master_data.updated",
      correlationId,
    });
    return masterData;
  });
}

type IdeaStatus =
  | "PROPOSED"
  | "UNDER_REVIEW"
  | "PENDING_APPROVAL"
  | "REVISION_REQUIRED"
  | "ACCEPTED"
  | "REJECTED"
  | "CONVERTED"
  | "ARCHIVED";

const IDEA_TRANSITIONS: Record<IdeaStatus, IdeaStatus[]> = {
  PROPOSED: ["UNDER_REVIEW", "REJECTED", "ARCHIVED"],
  UNDER_REVIEW: ["PENDING_APPROVAL", "REJECTED", "ARCHIVED"],
  PENDING_APPROVAL: ["ACCEPTED", "REVISION_REQUIRED", "REJECTED"],
  REVISION_REQUIRED: ["UNDER_REVIEW", "ARCHIVED"],
  ACCEPTED: ["ARCHIVED"],
  REJECTED: [],
  CONVERTED: ["ARCHIVED"],
  ARCHIVED: [],
};

function assertUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error("Only HTTPS is allowed");
    return url.toString();
  } catch {
    throw new PrCenterError(
      "A source URL must be a valid HTTPS URL",
      422,
      "INVALID_SOURCE_URL",
    );
  }
}

function requestNumber(type: CreateRequestInput["type"]): string {
  return `${type}-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

type PrUserDraftKind = "REQUEST" | "IDEA";

const USER_DRAFT_FIELDS: Record<PrUserDraftKind, readonly string[]> = {
  REQUEST: [
    "type",
    "title",
    "department",
    "owner",
    "requestedDate",
    "source",
    "objective",
    "audience",
    "startTime",
    "endTime",
    "travel",
    "assigner",
    "whyNow",
    "contentTypes",
    "priority",
    "priorityReason",
    "projectDetails",
    "confirmed",
  ],
  IDEA: [
    "title",
    "rationale",
    "audience",
    "pillar",
    "channel",
    "priority",
    "campaign",
    "evidenceUrls",
  ],
};

function normalizeUserDraft(
  kind: PrUserDraftKind,
  value: unknown,
): Prisma.InputJsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new PrCenterError("Draft must be an object", 422, "INVALID_DRAFT");
  const input = value as Record<string, unknown>;
  const payload: Record<string, Prisma.InputJsonValue> = {};
  for (const field of USER_DRAFT_FIELDS[kind]) {
    const fieldValue = input[field];
    if (typeof fieldValue === "string" || typeof fieldValue === "boolean") {
      if (fieldValue.toString().length > 10_000)
        throw new PrCenterError("Draft field is too long", 422, "INVALID_DRAFT");
      payload[field] = fieldValue;
    } else if (Array.isArray(fieldValue)) {
      if (
        fieldValue.length > 100 ||
        !fieldValue.every((item) => typeof item === "string" && item.length <= 2048)
      )
        throw new PrCenterError("Draft list is invalid", 422, "INVALID_DRAFT");
      payload[field] = fieldValue;
    } else if (fieldValue !== undefined && fieldValue !== null) {
      throw new PrCenterError("Draft field is invalid", 422, "INVALID_DRAFT");
    }
  }
  if (JSON.stringify(payload).length > 100_000)
    throw new PrCenterError("Draft exceeds the allowed size", 422, "INVALID_DRAFT");
  return payload;
}

function assertCanSaveUserDraft(actor: PrCenterActor, kind: PrUserDraftKind) {
  const allowed =
    kind === "REQUEST"
      ? canCreateRequest(actorRoles(actor))
      : canCreateIdea(actorRoles(actor));
  if (!allowed) throw new PrCenterError("You cannot save this draft", 403, "FORBIDDEN");
}

export async function getUserDraft(actor: PrCenterActor, kind: PrUserDraftKind) {
  assertCanSaveUserDraft(actor, kind);
  return prisma.prUserDraft.findUnique({
    where: { userId_kind: { userId: actor.id, kind } },
    select: { payload: true, updatedAt: true },
  });
}

export async function saveUserDraft(
  actor: PrCenterActor,
  kind: PrUserDraftKind,
  value: unknown,
) {
  assertCanSaveUserDraft(actor, kind);
  const payload = normalizeUserDraft(kind, value);
  return prisma.prUserDraft.upsert({
    where: { userId_kind: { userId: actor.id, kind } },
    create: {
      organizationId: actor.organizationId,
      userId: actor.id,
      kind,
      payload,
    },
    update: { organizationId: actor.organizationId, payload },
    select: { updatedAt: true },
  });
}

export async function deleteUserDraft(actor: PrCenterActor, kind: PrUserDraftKind) {
  assertCanSaveUserDraft(actor, kind);
  return prisma.prUserDraft.deleteMany({
    where: { userId: actor.id, organizationId: actor.organizationId, kind },
  });
}

function auditAndOutbox(
  tx: Prisma.TransactionClient,
  input: {
    actor: PrCenterActor;
    action: string;
    entityType: string;
    entityId: string;
    after: Prisma.InputJsonValue;
    eventType: string;
    correlationId: string;
  },
) {
  return Promise.all([
    tx.prAuditEvent.create({
      data: {
        organizationId: input.actor.organizationId,
        actorId: input.actor.id,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        correlationId: input.correlationId,
        after: input.after,
      },
    }),
    tx.prOutboxEvent.create({
      data: {
        aggregateType: input.entityType,
        aggregateId: input.entityId,
        eventType: input.eventType,
        payload: input.after,
        idempotencyKey: `${input.eventType}:${input.entityId}:${input.correlationId}`,
      },
    }),
  ]);
}

export async function createRequest(
  actor: PrCenterActor,
  input: CreateRequestInput,
  correlationId: string = randomUUID(),
) {
  if (!canCreateRequest(actorRoles(actor)))
    throw new PrCenterError("You cannot create a request", 403, "FORBIDDEN");
  if (!actor.departmentId)
    throw new PrCenterError("An active department is required", 403, "SCOPE_REQUIRED");
  const departmentId = actor.departmentId;
  const title = input.title.trim();
  if (title.length < 3 || title.length > 300)
    throw new PrCenterError(
      "Title must contain 3 to 300 characters",
      422,
      "INVALID_TITLE",
    );
  const sourceUrls = [...new Set(input.sourceUrls.map(assertUrl))];
  const offsiteDetails = validateOffsiteDetails(
    input.type,
    input.offsiteDetails,
    Boolean(input.requestDetails),
  );
  const requestDetails = validateRequestDetails(input.type, input.requestDetails);
  if (requestDetails && sourceUrls.length === 0)
    throw new PrCenterError(
      "At least one source URL is required",
      422,
      "INVALID_SOURCE_URL",
    );
  const revisionDetails = requestDetails
    ? { ...requestDetails, ...(offsiteDetails || {}) }
    : offsiteDetails;
  const contentTypes =
    input.type === "PR" && requestDetails?.contentTypes.length
      ? requestDetails.contentTypes
      : [input.type === "PR" ? "PR Content" : "Off-site Support"];

  return prisma.$transaction(async (tx) => {
    const request = await tx.prRequest.create({
      data: {
        organizationId: actor.organizationId,
        departmentId,
        requesterId: actor.id,
        requestNumber: requestNumber(input.type),
        type: input.type,
        title,
        priority: validatedPriority(input.priority),
        priorityReason: input.priorityReason?.trim() || null,
        requestedFor: input.requestedFor,
        revisions: {
          create: {
            revisionNumber: 1,
            title,
            objective: input.objective?.trim() || null,
            audience: input.audience?.trim() || null,
            offsiteDetails: revisionDetails,
          },
        },
        sources: { create: sourceUrls.map((url) => ({ url })) },
        tasks: {
          create: contentTypes.map((contentType) => ({
            title: `${contentType}: ${title}`,
            contentType,
            ownerId: actor.id,
            dueAt: input.requestedFor,
          })),
        },
      },
      include: { revisions: true, sources: true, tasks: true },
    });
    const operationsRoles = await tx.prUserRole.findMany({
      where: {
        organizationId: actor.organizationId,
        role: "PR_OPERATIONS",
        OR: [{ departmentId: departmentId }, { departmentId: null }],
        user: { active: true },
      },
      select: { userId: true },
    });
    const recipients = new Set([actor.id, ...operationsRoles.map((role) => role.userId)]);
    await tx.prNotification.createMany({
      data: [...recipients].map((userId) => ({
        userId,
        title: "New PR request",
        body: `${title} was saved as a draft.`,
        target: `request:${request.id}`,
      })),
    });
    await auditAndOutbox(tx, {
      actor,
      action: "request.created",
      entityType: "request",
      entityId: request.id,
      after: { requestNumber: request.requestNumber, version: request.version },
      eventType: "pr.request.created",
      correlationId,
    });
    return request;
  });
}

export async function listRequests(actor: PrCenterActor, take = 25, cursor?: string) {
  const limit = Math.min(Math.max(take, 1), 100);
  const where = requestReadWhere(actor);
  return prisma.prRequest.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      department: { select: { name: true } },
      requester: { select: { displayName: true } },
      sources: { select: { url: true } },
      statusHistory: {
        where: { toState: { in: ["REJECTED", "APPROVED"] } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { toState: true, reason: true, createdAt: true },
      },
      tasks: {
        include: {
          owner: { select: { displayName: true } },
          revisions: {
            orderBy: { revisionNumber: "desc" },
            take: 1,
            select: {
              revisionNumber: true,
              body: true,
              keyMessage: true,
              finalAssetId: true,
            },
          },
        },
      },
      attachments: {
        where: { taskId: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          kind: true,
          version: true,
          file: {
            select: {
              id: true,
              fileName: true,
              mimeType: true,
              sizeBytes: true,
              scanStatus: true,
              deletedAt: true,
            },
          },
        },
      },
      revisions: { orderBy: { revisionNumber: "desc" }, take: 1 },
    },
  });
}

export async function listContentLibraryRequests(
  actor: PrCenterActor,
  take = 25,
  cursor?: string,
) {
  const allowedRoles = ["PR_OPERATIONS", "SCOPED_ADMINISTRATOR"] as const;
  if (!allowedRoles.some((role) => actorHasRole(actor, role)))
    throw new PrCenterError("You cannot view the Content Library", 403, "FORBIDDEN");
  const limit = Math.min(Math.max(take, 1), 100);
  const scopes = roleDepartmentClauses(actor, allowedRoles);
  return prisma.prRequest.findMany({
    where: { organizationId: actor.organizationId, OR: scopes },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      department: { select: { name: true } },
      revisions: {
        orderBy: { revisionNumber: "desc" },
        select: {
          revisionNumber: true,
          title: true,
          objective: true,
          audience: true,
          offsiteDetails: true,
          changeSummary: true,
          createdAt: true,
        },
      },
      sources: { select: { id: true, label: true, url: true, createdAt: true } },
      attachments: {
        where: { taskId: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          kind: true,
          version: true,
          createdAt: true,
          file: {
            select: {
              fileName: true,
              mimeType: true,
              sizeBytes: true,
              scanStatus: true,
              deletedAt: true,
            },
          },
        },
      },
    },
  });
}

async function requestInScope(actor: PrCenterActor, requestId: string) {
  const request = await prisma.prRequest.findFirst({
    where: { id: requestId, ...requestReadWhere(actor) },
    include: {
      revisions: { orderBy: { revisionNumber: "desc" } },
      sources: true,
      statusHistory: {
        where: { toState: { in: ["REJECTED", "APPROVED"] } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { toState: true, reason: true, createdAt: true },
      },
      tasks: true,
      attachments: {
        where: { taskId: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          kind: true,
          version: true,
          file: {
            select: {
              id: true,
              fileName: true,
              mimeType: true,
              sizeBytes: true,
              scanStatus: true,
              deletedAt: true,
            },
          },
        },
      },
    },
  });
  if (!request) throw new PrCenterError("Request not found", 404, "NOT_FOUND");
  return request;
}

export async function requestDetail(actor: PrCenterActor, requestId: string) {
  return requestInScope(actor, requestId);
}

export async function updateRequestDraft(
  actor: PrCenterActor,
  requestId: string,
  fromVersion: number,
  input: CreateRequestInput,
  correlationId: string = randomUUID(),
) {
  const request = await requestInScope(actor, requestId);
  if (request.requesterId !== actor.id && !actorHasRole(actor, "SCOPED_ADMINISTRATOR"))
    throw new PrCenterError("You cannot amend this request", 403, "FORBIDDEN");
  if (
    !(["DRAFT", "SUBMITTED", "REJECTED", "WITHDRAWN"] as string[]).includes(
      request.status,
    )
  )
    throw new PrCenterError(
      "Only draft, pending, rejected, or withdrawn requests can be amended",
      422,
      "INVALID_TRANSITION",
    );
  if (request.version !== fromVersion)
    throw new PrCenterError(
      "This request has changed. Refresh and try again.",
      409,
      "STALE_UPDATE",
    );
  const title = input.title.trim();
  if (title.length < 3 || title.length > 300)
    throw new PrCenterError(
      "Title must contain 3 to 300 characters",
      422,
      "INVALID_TITLE",
    );
  const sourceUrls = [...new Set(input.sourceUrls.map(assertUrl))];
  const offsiteDetails = validateOffsiteDetails(
    input.type,
    input.offsiteDetails,
    Boolean(input.requestDetails),
  );
  const requestDetails = validateRequestDetails(input.type, input.requestDetails);
  if (requestDetails && sourceUrls.length === 0)
    throw new PrCenterError(
      "At least one source URL is required",
      422,
      "INVALID_SOURCE_URL",
    );
  const revisionDetails = requestDetails
    ? { ...requestDetails, ...(offsiteDetails || {}) }
    : offsiteDetails;
  if (
    request.tasks.some((task) => task.status !== "DRAFT" && task.status !== "CANCELLED")
  )
    throw new PrCenterError(
      "This request has task work in progress and cannot be amended. Contact PR Operations.",
      409,
      "REQUEST_WORK_ALREADY_STARTED",
    );
  return prisma.$transaction(async (tx) => {
    const revisionNumber = (request.revisions[0]?.revisionNumber || 0) + 1;
    const returnToDraft = request.status !== "DRAFT";
    const updated = await tx.prRequest.updateMany({
      where: { id: request.id, version: fromVersion, status: request.status },
      data: {
        title,
        type: input.type,
        priority: input.priority ? validatedPriority(input.priority) : request.priority,
        priorityReason: input.priorityReason?.trim() || null,
        requestedFor: input.requestedFor,
        ...(returnToDraft ? { status: "DRAFT" as const } : {}),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1)
      throw new PrCenterError(
        "This request has changed. Refresh and try again.",
        409,
        "STALE_UPDATE",
      );
    await tx.prRequestRevision.create({
      data: {
        requestId: request.id,
        revisionNumber,
        title,
        objective: input.objective?.trim() || null,
        audience: input.audience?.trim() || null,
        offsiteDetails: revisionDetails,
        changeSummary: "Requester amendment",
      },
    });
    await tx.prRequestSource.deleteMany({ where: { requestId: request.id } });
    if (sourceUrls.length)
      await tx.prRequestSource.createMany({
        data: sourceUrls.map((url) => ({ requestId: request.id, url })),
      });
    if (returnToDraft) {
      await tx.prStatusHistory.create({
        data: {
          requestId: request.id,
          fromState: request.status,
          toState: "DRAFT",
          reason: `Requester amended revision ${revisionNumber}; resubmission required`,
          actorId: actor.id,
        },
      });
      for (const task of request.tasks) {
        if (task.status === "DRAFT") continue;
        const reopened = await tx.prTask.updateMany({
          where: { id: task.id, status: "CANCELLED", version: task.version },
          data: { status: "DRAFT", version: { increment: 1 } },
        });
        if (reopened.count !== 1)
          throw new PrCenterError(
            "A related task changed while reopening the request. Refresh and try again.",
            409,
            "STALE_UPDATE",
          );
        await tx.prStatusHistory.create({
          data: {
            taskId: task.id,
            fromState: "CANCELLED",
            toState: "DRAFT",
            reason: `Parent request amended as revision ${revisionNumber}`,
            actorId: actor.id,
          },
        });
      }
    }
    if (request.status === "SUBMITTED") {
      const operations = await tx.prUserRole.findMany({
        where: {
          organizationId: request.organizationId,
          role: "PR_OPERATIONS",
          OR: [{ departmentId: request.departmentId }, { departmentId: null }],
          user: { active: true },
        },
        select: { userId: true },
      });
      const recipients = [...new Set(operations.map(({ userId }) => userId))];
      if (recipients.length)
        await tx.prNotification.createMany({
          data: recipients.map((userId) => ({
            userId,
            title: "Request amended; resubmission required",
            body: `${title} was amended and returned to draft by its requester. It will re-enter the approval queue after resubmission.`,
            target: `request:${request.id}`,
          })),
        });
    }
    await auditAndOutbox(tx, {
      actor,
      action: "request.amended",
      entityType: "request",
      entityId: request.id,
      after: {
        revisionNumber,
        previousStatus: request.status,
        status: returnToDraft ? "DRAFT" : request.status,
        resubmissionRequired: returnToDraft,
        version: fromVersion + 1,
      },
      eventType: "pr.request.amended",
      correlationId,
    });
    return tx.prRequest.findUniqueOrThrow({
      where: { id: request.id },
      include: { revisions: true, sources: true, tasks: true },
    });
  });
}

export async function transitionRequest(
  actor: PrCenterActor,
  requestId: string,
  fromVersion: number,
  status: "SUBMITTED" | "WITHDRAWN",
  correlationId: string = randomUUID(),
) {
  const request = await requestInScope(actor, requestId);
  if (request.requesterId !== actor.id && !actorHasRole(actor, "SCOPED_ADMINISTRATOR"))
    throw new PrCenterError("You cannot update this request", 403, "FORBIDDEN");
  const allowed =
    (status === "SUBMITTED" && request.status === "DRAFT") ||
    (status === "WITHDRAWN" && ["DRAFT", "SUBMITTED"].includes(request.status));
  if (!allowed)
    throw new PrCenterError(
      "This request transition is not allowed",
      422,
      "INVALID_TRANSITION",
    );
  if (request.version !== fromVersion)
    throw new PrCenterError(
      "This request has changed. Refresh and try again.",
      409,
      "STALE_UPDATE",
    );
  return prisma.$transaction(async (tx) => {
    const updated = await tx.prRequest.updateMany({
      where: { id: request.id, version: fromVersion },
      data: { status: status as PrRequestStatus, version: { increment: 1 } },
    });
    if (updated.count !== 1)
      throw new PrCenterError(
        "This request has changed. Refresh and try again.",
        409,
        "STALE_UPDATE",
      );
    await tx.prStatusHistory.create({
      data: {
        requestId: request.id,
        fromState: request.status,
        toState: status,
        actorId: actor.id,
      },
    });
    if (status === "WITHDRAWN") {
      for (const task of request.tasks) {
        if (task.status !== "DRAFT") continue;
        const cancelled = await tx.prTask.updateMany({
          where: { id: task.id, status: "DRAFT", version: task.version },
          data: { status: "CANCELLED", version: { increment: 1 } },
        });
        if (cancelled.count !== 1)
          throw new PrCenterError(
            "A task changed while this request was being withdrawn. Refresh and try again.",
            409,
            "STALE_UPDATE",
          );
        await tx.prStatusHistory.create({
          data: {
            taskId: task.id,
            fromState: task.status,
            toState: "CANCELLED",
            reason: "Parent request withdrawn",
            actorId: actor.id,
          },
        });
      }
    }
    if (status === "SUBMITTED") {
      const approverRoles = await tx.prUserRole.findMany({
        where: {
          organizationId: request.organizationId,
          role: "PR_OPERATIONS",
          OR: [{ departmentId: request.departmentId }, { departmentId: null }],
          user: { active: true },
        },
        select: { userId: true },
      });
      if (approverRoles.length === 0)
        throw new PrCenterError(
          "No active PR Operations reviewer is assigned to this request department",
          409,
          "NO_INTAKE_REVIEWER",
        );
      const recipients = new Set([
        request.requesterId,
        ...approverRoles.map((role) => role.userId),
      ]);
      await tx.prNotification.createMany({
        data: [...recipients].map((userId) => ({
          userId,
          title:
            userId === request.requesterId
              ? "Request submitted"
              : "Request awaiting approval",
          body: `${request.title} was submitted and is waiting for PR review.`,
          target: `request:${request.id}`,
        })),
      });
    }
    await auditAndOutbox(tx, {
      actor,
      action: `request.${status.toLowerCase()}`,
      entityType: "request",
      entityId: request.id,
      after: { status, version: fromVersion + 1 },
      eventType: `pr.request.${status.toLowerCase()}`,
      correlationId,
    });
    return tx.prRequest.findUniqueOrThrow({ where: { id: request.id } });
  });
}

export async function listIdeas(
  actor: PrCenterActor,
  pagination: { take?: number; offset?: number; search?: string; status?: string } = {},
) {
  const take = pagination.take ?? 50;
  const offset = pagination.offset ?? 0;
  const rawSearch: unknown = pagination.search;
  const search = typeof rawSearch === "string" ? rawSearch.trim() : "";
  const status = pagination.status || undefined;
  const allowedStatuses = [
    "PROPOSED",
    "UNDER_REVIEW",
    "PENDING_APPROVAL",
    "REVISION_REQUIRED",
    "ACCEPTED",
    "REJECTED",
    "CONVERTED",
    "ARCHIVED",
  ] as const;
  if (
    !Number.isSafeInteger(take) ||
    take < 1 ||
    take > 100 ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 100_000 ||
    (rawSearch !== undefined && typeof rawSearch !== "string") ||
    search.length > 100 ||
    (status !== undefined &&
      !allowedStatuses.includes(status as (typeof allowedStatuses)[number]))
  ) {
    throw new PrCenterError(
      "Idea list filters are invalid",
      422,
      "INVALID_IDEA_LIST_QUERY",
    );
  }
  const ideaClauses: Prisma.PrContentIdeaWhereInput[] = [{ proposerId: actor.id }];
  ideaClauses.push(
    ...roleDepartmentClauses(actor, [
      "PR_OPERATIONS",
      "APPROVER",
      "SCOPED_ADMINISTRATOR",
    ]),
  );
  const searchClauses: Prisma.PrContentIdeaWhereInput[] = search
    ? [
        { title: { contains: search, mode: "insensitive" } },
        { rationale: { contains: search, mode: "insensitive" } },
        { audience: { contains: search, mode: "insensitive" } },
        { pillar: { contains: search, mode: "insensitive" } },
        { channel: { contains: search, mode: "insensitive" } },
        { priority: { contains: search, mode: "insensitive" } },
        { campaign: { contains: search, mode: "insensitive" } },
      ]
    : [];
  const where: Prisma.PrContentIdeaWhereInput = {
    organizationId: actor.organizationId,
    AND: [
      { OR: ideaClauses },
      ...(searchClauses.length > 0 ? [{ OR: searchClauses }] : []),
    ],
    ...(status ? { status: status as (typeof allowedStatuses)[number] } : {}),
  };
  const rows = await prisma.prContentIdea.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: offset,
    take: take + 1,
    select: {
      id: true,
      title: true,
      rationale: true,
      proposerId: true,
      audience: true,
      pillar: true,
      channel: true,
      priority: true,
      campaign: true,
      evidenceUrls: true,
      status: true,
      decisionReason: true,
      createdAt: true,
      convertedRequestId: true,
      version: true,
    },
  });
  const hasMore = rows.length > take;
  return {
    items: rows.slice(0, take),
    nextOffset: hasMore ? offset + take : null,
  };
}

export async function listIdeaComments(actor: PrCenterActor, ideaId: string) {
  const idea = await prisma.prContentIdea.findFirst({
    where: ideaCommentScopeWhere(actor, ideaId),
    select: { id: true },
  });
  if (!idea) throw new PrCenterError("Idea not found", 404, "NOT_FOUND");
  return prisma.prComment.findMany({
    where: { ideaId: idea.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      ideaId: true,
      body: true,
      authorId: true,
      createdAt: true,
      author: { select: { displayName: true } },
    },
  });
}

export async function addIdeaComment(
  actor: PrCenterActor,
  ideaId: string,
  rawBody: unknown,
  correlationId: string = randomUUID(),
) {
  if (typeof rawBody !== "string")
    throw new PrCenterError("A comment is required", 422, "INVALID_COMMENT");
  const commentBody = rawBody.trim();
  if (!commentBody)
    throw new PrCenterError("A comment is required", 422, "INVALID_COMMENT");
  if (commentBody.length > 2000)
    throw new PrCenterError(
      "A comment must be 2,000 characters or fewer",
      422,
      "INVALID_COMMENT",
    );

  const idea = await prisma.prContentIdea.findFirst({
    where: ideaCommentScopeWhere(actor, ideaId),
    select: { id: true },
  });
  if (!idea) throw new PrCenterError("Idea not found", 404, "NOT_FOUND");

  return prisma.$transaction(async (tx) => {
    const comment = await tx.prComment.create({
      data: { ideaId: idea.id, authorId: actor.id, body: commentBody },
      select: {
        id: true,
        ideaId: true,
        body: true,
        authorId: true,
        createdAt: true,
        author: { select: { displayName: true } },
      },
    });
    await auditAndOutbox(tx, {
      actor,
      action: "idea.comment_added",
      entityType: "content_idea",
      entityId: idea.id,
      after: { commentId: comment.id },
      eventType: "pr.idea.comment_added",
      correlationId,
    });
    return comment;
  });
}

export async function createIdea(
  actor: PrCenterActor,
  input: unknown,
  correlationId: string = randomUUID(),
) {
  if (!canCreateIdea(actorRoles(actor)) || !actor.departmentId)
    throw new PrCenterError("You cannot create an idea", 403, "FORBIDDEN");
  let ideaInput;
  try {
    ideaInput = normalizeCreateIdeaInput(input);
  } catch (error) {
    throw new PrCenterError(
      error instanceof Error ? error.message : "Invalid idea data",
      422,
      "INVALID_IDEA",
    );
  }
  return prisma.$transaction(async (tx) => {
    const idea = await tx.prContentIdea.create({
      data: {
        organizationId: actor.organizationId,
        departmentId: actor.departmentId!,
        proposerId: actor.id,
        title: ideaInput.title,
        rationale: ideaInput.rationale,
        audience: ideaInput.audience,
        pillar: ideaInput.pillar,
        channel: ideaInput.channel,
        priority: ideaInput.priority,
        campaign: ideaInput.campaign,
        evidenceUrls: ideaInput.evidenceUrls,
      },
    });
    const reviewers = await tx.prUserRole.findMany({
      where: {
        organizationId: actor.organizationId,
        role: "PR_OPERATIONS",
        OR: [{ departmentId: actor.departmentId }, { departmentId: null }],
        user: { active: true },
      },
      select: { userId: true },
    });
    if (reviewers.length > 0)
      await tx.prNotification.createMany({
        data: [...new Set(reviewers.map(({ userId }) => userId))].map((userId) => ({
          userId,
          title: "New Content Idea for review",
          body: idea.title,
          target: `idea:${idea.id}`,
        })),
      });
    await auditAndOutbox(tx, {
      actor,
      action: "idea.created",
      entityType: "content_idea",
      entityId: idea.id,
      after: {
        status: idea.status,
        version: idea.version,
        evidenceCount: ideaInput.evidenceUrls.length,
      },
      eventType: "pr.idea.created",
      correlationId,
    });
    return idea;
  });
}

export async function transitionIdea(
  actor: PrCenterActor,
  ideaId: string,
  fromVersion: number,
  to: IdeaStatus,
  reason: string | undefined,
  correlationId: string = randomUUID(),
) {
  if (!canAccessIdeaReview(actor))
    throw new PrCenterError("You cannot review an idea", 403, "FORBIDDEN");
  const ideaScope = ideaScopeWhere(actor, ideaId);
  const idea = await prisma.prContentIdea.findFirst({ where: ideaScope });
  if (!idea) throw new PrCenterError("Idea not found", 404, "NOT_FOUND");
  if (idea.version !== fromVersion)
    throw new PrCenterError(
      "This idea has changed. Refresh and try again.",
      409,
      "STALE_UPDATE",
    );
  if (!IDEA_TRANSITIONS[idea.status as IdeaStatus].includes(to))
    throw new PrCenterError(
      "This idea transition is not allowed",
      422,
      "INVALID_TRANSITION",
    );
  const admin = actorHasRole(actor, "SCOPED_ADMINISTRATOR");
  const prReviewer = actorHasRole(actor, "PR_OPERATIONS");
  const approver = actorHasRole(actor, "APPROVER");
  const prReviewTransition =
    (idea.status === "PROPOSED" && to === "UNDER_REVIEW") ||
    (idea.status === "UNDER_REVIEW" &&
      (to === "PENDING_APPROVAL" || to === "REJECTED")) ||
    (idea.status === "REVISION_REQUIRED" && to === "UNDER_REVIEW") ||
    ((idea.status === "ACCEPTED" || idea.status === "REJECTED") && to === "ARCHIVED");
  const approvalDecision =
    idea.status === "PENDING_APPROVAL" &&
    ["ACCEPTED", "REVISION_REQUIRED", "REJECTED"].includes(to);
  if (!admin && !((prReviewer && prReviewTransition) || (approver && approvalDecision)))
    throw new PrCenterError(
      "This idea transition requires another workflow role",
      403,
      "FORBIDDEN",
    );
  const decisionReason = reason?.trim() || "";
  if (
    (to === "ACCEPTED" || to === "REJECTED" || to === "REVISION_REQUIRED") &&
    !decisionReason
  )
    throw new PrCenterError(
      "A reason is required for an idea decision",
      422,
      "REASON_REQUIRED",
    );
  if (decisionReason.length > 5000)
    throw new PrCenterError("Decision reason is too long", 422, "INVALID_REASON");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.prContentIdea.updateMany({
      where: { ...ideaScope, version: fromVersion },
      data: {
        status: to as PrContentIdeaStatus,
        reviewerId: actor.id,
        decisionReason: decisionReason || idea.decisionReason || null,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1)
      throw new PrCenterError(
        "This idea has changed. Refresh and try again.",
        409,
        "STALE_UPDATE",
      );
    const notifyApprovers = to === "PENDING_APPROVAL";
    const notificationRecipients = notifyApprovers
      ? await tx.prUserRole.findMany({
          where: {
            organizationId: idea.organizationId,
            role: "APPROVER",
            OR: [{ departmentId: idea.departmentId }, { departmentId: null }],
            user: { active: true },
          },
          select: { userId: true },
        })
      : [{ userId: idea.proposerId }];
    if (notificationRecipients.length > 0)
      await tx.prNotification.createMany({
        data: [...new Set(notificationRecipients.map(({ userId }) => userId))].map(
          (userId) => ({
            userId,
            title: `Content Idea ${to.toLowerCase().replaceAll("_", " ")}`,
            body: idea.title,
            target: `idea:${idea.id}`,
          }),
        ),
      });
    await auditAndOutbox(tx, {
      actor,
      action: "idea.transitioned",
      entityType: "content_idea",
      entityId: idea.id,
      after: {
        from: idea.status,
        to,
        version: fromVersion + 1,
        reason: decisionReason || null,
      },
      eventType: "pr.idea.transitioned",
      correlationId,
    });
    return tx.prContentIdea.findUniqueOrThrow({ where: { id: idea.id } });
  });
}

export async function reviseIdea(
  actor: PrCenterActor,
  ideaId: string,
  fromVersion: number,
  input: unknown,
  correlationId: string = randomUUID(),
) {
  if (!actor.departmentId)
    throw new PrCenterError("An active department is required", 403, "SCOPE_REQUIRED");
  const departmentId = actor.departmentId;
  const idea = await prisma.prContentIdea.findFirst({
    where: {
      id: ideaId,
      organizationId: actor.organizationId,
      proposerId: actor.id,
      departmentId,
    },
  });
  if (!idea) throw new PrCenterError("Idea not found", 404, "NOT_FOUND");
  if (idea.status !== "REVISION_REQUIRED")
    throw new PrCenterError(
      "Only ideas requiring revision can be amended",
      422,
      "INVALID_TRANSITION",
    );
  if (idea.version !== fromVersion)
    throw new PrCenterError(
      "This idea has changed. Refresh and try again.",
      409,
      "STALE_UPDATE",
    );
  let ideaInput;
  try {
    ideaInput = normalizeCreateIdeaInput(input);
  } catch (error) {
    throw new PrCenterError(
      error instanceof Error ? error.message : "Invalid idea data",
      422,
      "INVALID_IDEA",
    );
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.prContentIdea.updateMany({
      where: {
        id: idea.id,
        organizationId: actor.organizationId,
        proposerId: actor.id,
        departmentId,
        status: "REVISION_REQUIRED",
        version: fromVersion,
      },
      data: {
        title: ideaInput.title,
        rationale: ideaInput.rationale,
        audience: ideaInput.audience,
        pillar: ideaInput.pillar,
        channel: ideaInput.channel,
        priority: ideaInput.priority,
        campaign: ideaInput.campaign,
        evidenceUrls: ideaInput.evidenceUrls,
        status: "UNDER_REVIEW",
        reviewerId: null,
        decisionReason: null,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1)
      throw new PrCenterError(
        "This idea has changed. Refresh and try again.",
        409,
        "STALE_UPDATE",
      );
    const reviewers = await tx.prUserRole.findMany({
      where: {
        organizationId: actor.organizationId,
        role: "PR_OPERATIONS",
        OR: [{ departmentId: idea.departmentId }, { departmentId: null }],
        user: { active: true },
      },
      select: { userId: true },
    });
    if (reviewers.length > 0)
      await tx.prNotification.createMany({
        data: [...new Set(reviewers.map(({ userId }) => userId))].map((userId) => ({
          userId,
          title: "Content Idea revised and ready for review",
          body: ideaInput.title,
          target: `idea:${idea.id}`,
        })),
      });
    await auditAndOutbox(tx, {
      actor,
      action: "idea.revised",
      entityType: "content_idea",
      entityId: idea.id,
      after: { from: "REVISION_REQUIRED", to: "UNDER_REVIEW", version: fromVersion + 1 },
      eventType: "pr.idea.revised",
      correlationId,
    });
    return tx.prContentIdea.findUniqueOrThrow({ where: { id: idea.id } });
  });
}

export async function convertIdea(
  actor: PrCenterActor,
  ideaId: string,
  fromVersion: number,
  correlationId: string = randomUUID(),
) {
  if (!canReviewIdeas(actorRoles(actor)))
    throw new PrCenterError("You cannot convert an idea", 403, "FORBIDDEN");
  const ideaScope = ideaScopeWhere(actor, ideaId);
  const idea = await prisma.prContentIdea.findFirst({ where: ideaScope });
  if (!idea) throw new PrCenterError("Idea not found", 404, "NOT_FOUND");
  if (idea.version !== fromVersion)
    throw new PrCenterError(
      "This idea has changed. Refresh and try again.",
      409,
      "STALE_UPDATE",
    );
  if (idea.status !== "ACCEPTED")
    throw new PrCenterError(
      "Only accepted ideas can be converted",
      422,
      "INVALID_TRANSITION",
    );
  return prisma.$transaction(async (tx) => {
    const request = await tx.prRequest.create({
      data: {
        organizationId: idea.organizationId,
        departmentId: idea.departmentId,
        requesterId: idea.proposerId,
        requestNumber: requestNumber("PR"),
        type: "PR",
        title: idea.title,
        revisions: {
          create: {
            revisionNumber: 1,
            title: idea.title,
            objective: idea.rationale,
            audience: idea.audience,
          },
        },
        tasks: {
          create: {
            title: idea.title,
            contentType: "PR Content",
            ownerId: actor.id,
          },
        },
      },
      include: { tasks: true },
    });
    const updated = await tx.prContentIdea.updateMany({
      where: { ...ideaScope, status: "ACCEPTED", version: fromVersion },
      data: {
        status: "CONVERTED",
        reviewerId: actor.id,
        convertedRequestId: request.id,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1)
      throw new PrCenterError(
        "This idea has changed. Refresh and try again.",
        409,
        "STALE_UPDATE",
      );
    await auditAndOutbox(tx, {
      actor,
      action: "idea.converted",
      entityType: "content_idea",
      entityId: idea.id,
      after: {
        requestId: request.id,
        taskId: request.tasks[0]?.id,
        version: fromVersion + 1,
      },
      eventType: "pr.idea.converted",
      correlationId,
    });
    return { ideaId: idea.id, request, task: request.tasks[0] };
  });
}

function assertCanReadMessageHouse(actor: PrCenterActor) {
  if (!canManageTasks(actorRoles(actor)) && !actorHasRole(actor, "EXECUTIVE_READ_ONLY"))
    throw new PrCenterError("You cannot view Message House", 403, "FORBIDDEN");
}

function assertCanManageMessageHouse(actor: PrCenterActor) {
  if (!canManageTasks(actorRoles(actor)))
    throw new PrCenterError("You cannot edit Message House", 403, "FORBIDDEN");
}

export async function messageHouseDraft(actor: PrCenterActor) {
  assertCanManageMessageHouse(actor);
  return prisma.prMessageHouseVersion.findFirst({
    where: {
      organizationId: actor.organizationId,
      ownerId: actor.id,
      status: "DRAFT",
    },
    orderBy: { versionNumber: "desc" },
  });
}

export async function saveMessageHouseDraft(
  actor: PrCenterActor,
  input: unknown,
  draftId?: string,
  correlationId: string = randomUUID(),
) {
  assertCanManageMessageHouse(actor);
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new PrCenterError(
      "Message House data is required",
      422,
      "INVALID_MESSAGE_HOUSE",
    );
  const value = input as Record<string, unknown>;
  const vision = typeof value.vision === "string" ? value.vision.trim() : "";
  const positioning =
    typeof value.positioning === "string" ? value.positioning.trim() : "";
  const foundation = typeof value.foundation === "string" ? value.foundation.trim() : "";
  const sourceRationale =
    typeof value.sourceRationale === "string" ? value.sourceRationale.trim() : "";
  const pillars = Array.isArray(value.pillars)
    ? [
        ...new Set(
          value.pillars
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ]
    : [];
  if (
    !vision ||
    !positioning ||
    !foundation ||
    pillars.length === 0 ||
    vision.length > 5000 ||
    positioning.length > 5000 ||
    foundation.length > 5000 ||
    sourceRationale.length > 5000 ||
    pillars.some((pillar) => pillar.length > 300)
  )
    throw new PrCenterError(
      "Complete the required Message House fields with valid lengths",
      422,
      "INVALID_MESSAGE_HOUSE",
    );

  return prisma.$transaction(async (tx) => {
    let saved;
    if (draftId) {
      const existing = await tx.prMessageHouseVersion.findFirst({
        where: {
          id: draftId,
          organizationId: actor.organizationId,
          ownerId: actor.id,
          status: "DRAFT",
        },
      });
      if (!existing)
        throw new PrCenterError("Message House draft not found", 404, "NOT_FOUND");
      saved = await tx.prMessageHouseVersion.update({
        where: { id: existing.id },
        data: { vision, positioning, pillars, foundation, sourceRationale },
      });
    } else {
      const latest = await tx.prMessageHouseVersion.findFirst({
        where: { organizationId: actor.organizationId },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      saved = await tx.prMessageHouseVersion.create({
        data: {
          organizationId: actor.organizationId,
          versionNumber: (latest?.versionNumber ?? 0) + 1,
          status: "DRAFT",
          vision,
          positioning,
          pillars,
          foundation,
          sourceRationale: sourceRationale || null,
          ownerId: actor.id,
        },
      });
    }
    await auditAndOutbox(tx, {
      actor,
      action: "message_house.draft_saved",
      entityType: "message_house_version",
      entityId: saved.id,
      after: { versionNumber: saved.versionNumber, status: saved.status },
      eventType: "pr.message_house.draft_saved",
      correlationId,
    });
    return saved;
  });
}

export async function currentMessageHouse(actor: PrCenterActor) {
  assertCanReadMessageHouse(actor);
  return prisma.prMessageHouseVersion.findFirst({
    where: {
      organizationId: actor.organizationId,
      status: "APPROVED",
      effectiveAt: { lte: new Date() },
    },
    orderBy: [{ effectiveAt: "desc" }, { versionNumber: "desc" }],
    select: {
      versionNumber: true,
      vision: true,
      positioning: true,
      pillars: true,
      foundation: true,
      effectiveAt: true,
    },
  });
}

export async function messageHouseHistory(actor: PrCenterActor) {
  assertCanReadMessageHouse(actor);
  return prisma.prMessageHouseVersion.findMany({
    where: {
      organizationId: actor.organizationId,
      status: { in: ["APPROVED", "SUPERSEDED"] },
      effectiveAt: { lte: new Date() },
    },
    orderBy: [{ effectiveAt: "desc" }, { versionNumber: "desc" }],
    select: {
      versionNumber: true,
      vision: true,
      positioning: true,
      pillars: true,
      foundation: true,
      effectiveAt: true,
    },
  });
}

export async function updateTaskAssignment(
  actor: PrCenterActor,
  taskId: string,
  fromVersion: number,
  input: { ownerId: string | null; dueAt: Date | null },
  correlationId: string = randomUUID(),
) {
  if (!canManageTasks(actorRoles(actor)))
    throw new PrCenterError("You cannot assign a task", 403, "FORBIDDEN");
  const task = await prisma.prTask.findFirst({
    where: taskScopeWhere(actor, taskId),
    include: { request: { select: { status: true } } },
  });
  if (!task) throw new PrCenterError("Task not found", 404, "NOT_FOUND");
  if (
    task.request.status === "REJECTED" ||
    task.request.status === "CANCELLED" ||
    (task.status === "DRAFT" && task.request.status !== "APPROVED")
  )
    throw new PrCenterError(
      "The request must be approved before assigning this draft task",
      409,
      "REQUEST_NOT_APPROVED",
    );
  if (task.version !== fromVersion)
    throw new PrCenterError(
      "This task has changed. Refresh and try again.",
      409,
      "STALE_UPDATE",
    );
  if (input.ownerId) {
    const ownerScope = roleDepartmentScopes(actor, [
      "PR_OPERATIONS",
      "SCOPED_ADMINISTRATOR",
    ]);
    const owner = await prisma.prCenterUser.findFirst({
      where: {
        id: input.ownerId,
        organizationId: actor.organizationId,
        active: true,
        ...(!ownerScope.organizationWide
          ? { departmentId: { in: ownerScope.departmentIds } }
          : {}),
      },
    });
    if (!owner)
      throw new PrCenterError("Task owner is not available", 422, "INVALID_OWNER");
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.prTask.updateMany({
      where: { id: task.id, version: fromVersion },
      data: { ownerId: input.ownerId, dueAt: input.dueAt, version: { increment: 1 } },
    });
    if (updated.count !== 1)
      throw new PrCenterError(
        "This task has changed. Refresh and try again.",
        409,
        "STALE_UPDATE",
      );
    if (input.ownerId && input.ownerId !== task.ownerId)
      await tx.prNotification.create({
        data: {
          userId: input.ownerId,
          title: prefixedTitle("ASSIGNMENT", "PR Center task assigned"),
          body: task.title,
          target: `task:${task.id}`,
        },
      });
    // Material-change notification: when dueAt changes
    if (
      input.dueAt &&
      task.dueAt &&
      input.dueAt.getTime() !== task.dueAt.getTime() &&
      task.ownerId
    ) {
      const changeDesc = `Due date changed from ${task.dueAt.toISOString().slice(0, 10)} to ${input.dueAt.toISOString().slice(0, 10)}`;
      await tx.prNotification.create({
        data: {
          userId: task.ownerId,
          title: prefixedTitle("CHANGE", changeDesc),
          body: task.title,
          target: `task:${task.id}`,
        },
      });
    }
    await auditAndOutbox(tx, {
      actor,
      action: "task.assigned",
      entityType: "task",
      entityId: task.id,
      after: {
        ownerId: input.ownerId,
        dueAt: input.dueAt?.toISOString() || null,
        version: fromVersion + 1,
      },
      eventType: "pr.task.assigned",
      correlationId,
    });
    return tx.prTask.findUniqueOrThrow({
      where: { id: task.id },
      include: { owner: { select: { displayName: true } } },
    });
  });
}

export async function addTaskComment(
  actor: PrCenterActor,
  taskId: string,
  body: string,
  correlationId: string = randomUUID(),
) {
  const task = await prisma.prTask.findFirst({
    where: taskScopeWhere(actor, taskId),
    include: { request: true },
  });
  if (
    !task ||
    (!canReadAllRequests(actorRoles(actor)) && task.request.requesterId !== actor.id)
  )
    throw new PrCenterError("Task not found", 404, "NOT_FOUND");
  const text = body.trim();
  if (text.length < 1 || text.length > 5000)
    throw new PrCenterError(
      "Comment must contain 1 to 5000 characters",
      422,
      "INVALID_COMMENT",
    );
  return prisma.$transaction(async (tx) => {
    const comment = await tx.prComment.create({
      data: { taskId: task.id, authorId: actor.id, body: text },
      include: { author: { select: { displayName: true } } },
    });
    await auditAndOutbox(tx, {
      actor,
      action: "task.comment_added",
      entityType: "task",
      entityId: task.id,
      after: { commentId: comment.id },
      eventType: "pr.task.comment_added",
      correlationId,
    });
    return comment;
  });
}

export async function taskHistory(actor: PrCenterActor, taskId: string) {
  const task = await prisma.prTask.findFirst({
    where: taskScopeWhere(actor, taskId),
    include: { request: true },
  });
  if (
    !task ||
    (!canReadAllRequests(actorRoles(actor)) && task.request.requesterId !== actor.id)
  )
    throw new PrCenterError("Task not found", 404, "NOT_FOUND");
  const [comments, statuses, audit] = await Promise.all([
    prisma.prComment.findMany({
      where: { taskId },
      include: { author: { select: { displayName: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.prStatusHistory.findMany({ where: { taskId }, orderBy: { createdAt: "asc" } }),
    prisma.prAuditEvent.findMany({
      where: {
        organizationId: actor.organizationId,
        entityType: "task",
        entityId: taskId,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return { comments, statuses, audit };
}

export async function listNotifications(actor: PrCenterActor) {
  return prisma.prNotification.findMany({
    where: { userId: actor.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function markNotificationsRead(
  actor: PrCenterActor,
  notificationIds: string[],
  correlationId: string = randomUUID(),
) {
  const ids = [...new Set(notificationIds)].filter((id) => id.length > 0).slice(0, 100);
  if (ids.length === 0)
    throw new PrCenterError("Notification IDs are required", 422, "INVALID_BODY");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.prNotification.updateMany({
      where: { id: { in: ids }, userId: actor.id, readAt: null },
      data: { readAt: new Date() },
    });
    await auditAndOutbox(tx, {
      actor,
      action: "notification.read",
      entityType: "notification",
      entityId: ids.join(","),
      after: { count: updated.count },
      eventType: "pr.notification.read",
      correlationId,
    });
    return { updated: updated.count };
  });
}

export async function listAuditEvents(actor: PrCenterActor, take = 100) {
  const limit = Math.min(Math.max(take, 1), 100);
  return prisma.prAuditEvent.findMany({
    where: canReadAllRequests(actorRoles(actor))
      ? { organizationId: actor.organizationId }
      : { organizationId: actor.organizationId, actorId: actor.id },
    include: { actor: { select: { displayName: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function transitionTask(
  actor: PrCenterActor,
  taskId: string,
  fromVersion: number,
  to: WorkflowStatus,
  reason: string | undefined,
  correlationId: string = randomUUID(),
) {
  const task = await prisma.prTask.findFirst({
    where: taskScopeWhere(actor, taskId),
    include: { request: { select: { departmentId: true, status: true } } },
  });
  if (!task) throw new PrCenterError("Task not found", 404, "NOT_FOUND");
  if (
    task.request.status === "REJECTED" ||
    task.request.status === "CANCELLED" ||
    (task.status === "DRAFT" && task.request.status !== "APPROVED")
  )
    throw new PrCenterError(
      "The request must be approved before task work can begin",
      409,
      "REQUEST_NOT_APPROVED",
    );
  if (task.version !== fromVersion)
    throw new PrCenterError(
      "This task has changed. Refresh and try again.",
      409,
      "STALE_UPDATE",
    );
  if (!canTransitionTask(actorRoles(actor), task.status as WorkflowStatus, to)) {
    await prisma.prAuditEvent.create({
      data: {
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: "task.transition_blocked",
        entityType: "task",
        entityId: task.id,
        correlationId,
        before: { status: task.status, version: task.version },
        after: { attemptedStatus: to },
      },
    });
    throw new PrCenterError("This transition is not allowed", 422, "INVALID_TRANSITION");
  }
  if (
    isApprovalStageStatus(task.status) ||
    isApprovalStageStatus(to) ||
    to === "APPROVED"
  ) {
    const policy = loadApprovalPolicy();
    const firstStage = getFirstApprovalStage(policy);
    const isAuthorizedEntry =
      (task.status === "IN_PRODUCTION" || task.status === "REVISION_REQUIRED") &&
      to === firstStage.status;
    if (!isAuthorizedEntry) {
      await prisma.prAuditEvent.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.id,
          action: "approval.transition_blocked",
          entityType: "task",
          entityId: task.id,
          correlationId,
          before: { status: task.status, version: task.version },
          after: { attemptedStatus: to, policyVersion: policy.version },
        },
      });
      throw new PrCenterError(
        "Approval stages can only be entered through the configured first stage; approval decisions advance the workflow",
        422,
        "APPROVAL_STAGE_BYPASS_BLOCKED",
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.prTask.updateMany({
      where: { id: task.id, version: fromVersion },
      data: { status: to as PrTaskStatus, version: { increment: 1 } },
    });
    if (updated.count !== 1)
      throw new PrCenterError(
        "This task has changed. Refresh and try again.",
        409,
        "STALE_UPDATE",
      );
    await tx.prStatusHistory.create({
      data: {
        taskId: task.id,
        fromState: task.status,
        toState: to,
        reason: reason?.trim() || null,
        actorId: actor.id,
      },
    });
    await auditAndOutbox(tx, {
      actor,
      action: "task.transitioned",
      entityType: "task",
      entityId: task.id,
      after: { from: task.status, to, version: fromVersion + 1 },
      eventType: "pr.task.transitioned",
      correlationId,
    });
    return tx.prTask.findUniqueOrThrow({ where: { id: task.id } });
  });
}

function loadApprovalPolicy() {
  try {
    return parseApprovalPolicy(process.env.PR_CENTER_APPROVAL_POLICY_JSON);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "policy validation failed";
    throw new PrCenterError(
      `Approval is blocked: ${detail}`,
      503,
      "APPROVAL_POLICY_NOT_CONFIGURED",
    );
  }
}

function isApprovalStageStatus(status: string): boolean {
  return APPROVAL_STAGE_STATUSES.includes(
    status as (typeof APPROVAL_STAGE_STATUSES)[number],
  );
}

export function assertApprovalAuthority(actor: PrCenterActor) {
  if (!canApprove(actorRoles(actor)))
    throw new PrCenterError("You cannot record an approval decision", 403, "FORBIDDEN");
}

export async function createTaskRevision(
  actor: PrCenterActor,
  taskId: string,
  fromVersion: number,
  input: { body?: string; keyMessage?: string; changeSummary?: string },
  correlationId: string = randomUUID(),
) {
  if (!canManageTasks(actorRoles(actor)))
    throw new PrCenterError("You cannot revise this task", 403, "FORBIDDEN");
  const task = await prisma.prTask.findFirst({
    where: taskScopeWhere(actor, taskId),
    include: {
      request: { select: { status: true } },
      revisions: { orderBy: { revisionNumber: "desc" } },
    },
  });
  if (!task) throw new PrCenterError("Task not found", 404, "NOT_FOUND");
  if (task.request.status !== "APPROVED")
    throw new PrCenterError(
      "The request must be approved before a task revision can be created",
      409,
      "REQUEST_NOT_APPROVED",
    );
  if (task.status !== "IN_PRODUCTION" && task.status !== "REVISION_REQUIRED")
    throw new PrCenterError(
      "A task revision can only be created during production or after a revision request",
      409,
      "INVALID_REVISION_STATE",
    );
  if (task.version !== fromVersion)
    throw new PrCenterError(
      "This task has changed. Refresh and try again.",
      409,
      "STALE_UPDATE",
    );
  const body = input.body?.trim() || null;
  const keyMessage = input.keyMessage?.trim() || null;
  const changeSummary = input.changeSummary?.trim() || "";
  if (!body || body.length > 20_000)
    throw new PrCenterError(
      "Content body must contain 1 to 20,000 characters",
      422,
      "INVALID_TASK_REVISION",
    );
  if (!keyMessage || keyMessage.length > 2_000)
    throw new PrCenterError(
      "Key message must contain 1 to 2,000 characters",
      422,
      "INVALID_TASK_REVISION",
    );
  if (changeSummary.length > 1_000)
    throw new PrCenterError("Change summary is too long", 422, "INVALID_TASK_REVISION");
  const pendingSchedules = await prisma.prSchedule.findMany({
    where: { taskId: task.id, publishedAt: null },
    select: {
      id: true,
      channel: true,
      taskRevision: true,
      scheduledFor: true,
    },
  });
  return prisma.$transaction(async (tx) => {
    const updated = await tx.prTask.updateMany({
      where: { id: task.id, version: fromVersion },
      data: { status: "IN_PRODUCTION", version: { increment: 1 } },
    });
    if (updated.count !== 1)
      throw new PrCenterError(
        "This task has changed. Refresh and try again.",
        409,
        "STALE_UPDATE",
      );
    if (pendingSchedules.length > 0) {
      const invalidated = await tx.prSchedule.deleteMany({
        where: {
          id: { in: pendingSchedules.map((schedule) => schedule.id) },
          publishedAt: null,
        },
      });
      if (invalidated.count !== pendingSchedules.length)
        throw new PrCenterError(
          "A schedule changed while the content revision was being saved. Refresh and try again.",
          409,
          "STALE_UPDATE",
        );
      for (const schedule of pendingSchedules)
        await auditAndOutbox(tx, {
          actor,
          action: "task.schedule_invalidated_for_revision",
          entityType: "schedule",
          entityId: schedule.id,
          after: {
            taskId: task.id,
            channel: schedule.channel,
            taskRevision: schedule.taskRevision,
            scheduledFor: schedule.scheduledFor.toISOString(),
            invalidatedByRevision: (task.revisions[0]?.revisionNumber || 0) + 1,
          },
          eventType: "pr.task.schedule_invalidated",
          correlationId: `${correlationId}:${schedule.id}`,
        });
    }
    const revision = await tx.prTaskRevision.create({
      data: {
        taskId: task.id,
        revisionNumber: (task.revisions[0]?.revisionNumber || 0) + 1,
        body,
        keyMessage,
        immutableAt: new Date(),
      },
    });
    await tx.prStatusHistory.create({
      data: {
        taskId: task.id,
        fromState: task.status,
        toState: "IN_PRODUCTION",
        reason: changeSummary || "Material revision",
        actorId: actor.id,
      },
    });
    await auditAndOutbox(tx, {
      actor,
      action: "task.revised",
      entityType: "task",
      entityId: task.id,
      after: { revisionNumber: revision.revisionNumber, version: fromVersion + 1 },
      eventType: "pr.task.revised",
      correlationId,
    });
    return revision;
  });
}

export async function listApprovalQueue(actor: PrCenterActor) {
  if (!canApprove(actorRoles(actor)))
    throw new PrCenterError("You cannot view the approval queue", 403, "FORBIDDEN");
  return prisma.prTask.findMany({
    where: {
      request: requestScopeWhere(actor),
      status: {
        in: [
          "SOURCE_FACT_CHECK",
          "TECHNICAL_REVIEW",
          "PR_EDITORIAL_REVIEW",
          "MANAGEMENT_APPROVAL",
        ],
      },
    },
    include: {
      request: {
        select: {
          title: true,
          requesterId: true,
          status: true,
          sources: { select: { url: true } },
        },
      },
      owner: { select: { displayName: true } },
      revisions: {
        orderBy: { revisionNumber: "desc" },
        take: 1,
        select: {
          revisionNumber: true,
          body: true,
          keyMessage: true,
          finalAssetId: true,
        },
      },
    },
    orderBy: { updatedAt: "asc" },
  });
}

export async function listRequestApprovalQueue(actor: PrCenterActor) {
  if (!canDecideRequestIntake(actorRoles(actor)))
    throw new PrCenterError(
      "You cannot view the request approval queue",
      403,
      "FORBIDDEN",
    );
  const requests = await prisma.prRequest.findMany({
    where: {
      ...requestScopeWhere(actor),
      status: "SUBMITTED",
    },
    include: {
      department: { select: { name: true } },
      requester: { select: { displayName: true } },
      revisions: { orderBy: { revisionNumber: "desc" }, take: 1 },
      sources: { select: { url: true } },
      statusHistory: {
        where: { toState: { in: ["APPROVED", "REJECTED"] } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { toState: true, reason: true, createdAt: true },
      },
      tasks: { select: { id: true, status: true } },
      attachments: {
        where: { taskId: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          kind: true,
          version: true,
          file: {
            select: {
              id: true,
              fileName: true,
              mimeType: true,
              sizeBytes: true,
              scanStatus: true,
              deletedAt: true,
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return requests.map((request) => {
    const selfSubmitted = request.requesterId === actor.id;
    const taskWorkStarted = request.tasks.some((task) => task.status !== "DRAFT");
    return {
      ...request,
      intakeDecisionBlockedReason: selfSubmitted
        ? "SELF_SUBMISSION"
        : taskWorkStarted
          ? "TASK_WORK_ALREADY_STARTED"
          : null,
    };
  });
}

export async function recordRequestDecision(
  actor: PrCenterActor,
  requestId: string,
  fromVersion: number,
  input: { decision: "APPROVED" | "REJECTED"; reason?: string },
  correlationId: string = randomUUID(),
) {
  if (!canDecideRequestIntake(actorRoles(actor)))
    throw new PrCenterError("You cannot decide this request", 403, "FORBIDDEN");
  const request = await prisma.prRequest.findFirst({
    where: { id: requestId, ...requestScopeWhere(actor) },
    include: { tasks: { select: { id: true, status: true, version: true } } },
  });
  if (!request) throw new PrCenterError("Request not found", 404, "NOT_FOUND");
  if (request.requesterId === actor.id)
    throw new PrCenterError(
      "You cannot approve your own request",
      403,
      "SELF_APPROVAL_BLOCKED",
    );
  if (request.status !== "SUBMITTED")
    throw new PrCenterError(
      "This request is not waiting for an intake decision",
      422,
      "INVALID_TRANSITION",
    );
  if (request.version !== fromVersion)
    throw new PrCenterError(
      "This request has changed. Refresh and try again.",
      409,
      "STALE_UPDATE",
    );
  const reason = input.reason?.trim() || "";
  if (input.decision === "REJECTED" && !reason)
    throw new PrCenterError(
      "A reason is required when rejecting a request",
      422,
      "REASON_REQUIRED",
    );
  if (reason.length > 5000)
    throw new PrCenterError("Decision reason is too long", 422, "INVALID_REASON");
  if (request.tasks.some((task) => task.status !== "DRAFT"))
    throw new PrCenterError(
      "Task work has already started; use the task-stage workflow instead",
      409,
      "INTAKE_ALREADY_STARTED",
    );

  return prisma.$transaction(async (tx) => {
    const updated = await tx.prRequest.updateMany({
      where: { id: request.id, version: fromVersion, status: "SUBMITTED" },
      data: {
        status: input.decision as PrRequestStatus,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1)
      throw new PrCenterError(
        "This request has changed. Refresh and try again.",
        409,
        "STALE_UPDATE",
      );
    await tx.prStatusHistory.create({
      data: {
        requestId: request.id,
        fromState: request.status,
        toState: input.decision,
        reason: reason || null,
        actorId: actor.id,
      },
    });

    if (input.decision === "REJECTED") {
      for (const task of request.tasks) {
        const cancelled = await tx.prTask.updateMany({
          where: { id: task.id, status: "DRAFT", version: task.version },
          data: { status: "CANCELLED", version: { increment: 1 } },
        });
        if (cancelled.count !== 1)
          throw new PrCenterError(
            "A task changed while this request was being rejected. Refresh and try again.",
            409,
            "STALE_UPDATE",
          );
        await tx.prStatusHistory.create({
          data: {
            taskId: task.id,
            fromState: task.status,
            toState: "CANCELLED",
            reason,
            actorId: actor.id,
          },
        });
      }
    }

    const notifications: Array<{
      userId: string;
      title: string;
      body: string;
      target: string;
    }> = [
      {
        userId: request.requesterId,
        title: input.decision === "APPROVED" ? "Request approved" : "Request rejected",
        body:
          input.decision === "APPROVED"
            ? `${request.title} was approved and is being returned to PR Operations for assignment and planning.${reason ? ` Comment: ${reason}` : ""}`
            : `${request.title} was rejected. Reason: ${reason}`,
        target: `request:${request.id}`,
      },
    ];
    if (input.decision === "APPROVED") {
      const operationsRoles = await tx.prUserRole.findMany({
        where: {
          organizationId: request.organizationId,
          role: "PR_OPERATIONS",
          OR: [{ departmentId: request.departmentId }, { departmentId: null }],
          user: { active: true },
        },
        select: { userId: true },
      });
      for (const userId of new Set(operationsRoles.map((role) => role.userId))) {
        if (userId === actor.id) continue;
        notifications.push({
          userId,
          title: "Approved request ready for PR assignment",
          body: `${request.title} was approved. Assign an owner and begin planning.`,
          target: `request:${request.id}`,
        });
      }
    }
    await tx.prNotification.createMany({ data: notifications });
    await auditAndOutbox(tx, {
      actor,
      action: `request.${input.decision.toLowerCase()}`,
      entityType: "request",
      entityId: request.id,
      after: {
        status: input.decision,
        version: fromVersion + 1,
        reason: reason || null,
        authorityRole: actor.role,
      },
      eventType: `pr.request.${input.decision.toLowerCase()}`,
      correlationId,
    });
    return tx.prRequest.findUniqueOrThrow({ where: { id: request.id } });
  });
}

export async function recordApprovalDecision(
  actor: PrCenterActor,
  taskId: string,
  fromVersion: number,
  input: { decision: "APPROVED" | "REVISION_REQUIRED" | "REJECTED"; comment?: string },
  correlationId: string = randomUUID(),
) {
  assertApprovalAuthority(actor);
  const task = await prisma.prTask.findFirst({
    where: taskScopeWhere(actor, taskId),
    include: {
      request: true,
      revisions: { orderBy: { revisionNumber: "desc" }, take: 1 },
    },
  });
  if (!task) throw new PrCenterError("Task not found", 404, "NOT_FOUND");
  if (task.ownerId === actor.id || task.request.requesterId === actor.id)
    throw new PrCenterError(
      "You cannot approve your own work",
      403,
      "SELF_APPROVAL_BLOCKED",
    );
  if (task.version !== fromVersion)
    throw new PrCenterError(
      "This task has changed. Refresh and try again.",
      409,
      "STALE_UPDATE",
    );
  if (!isApprovalStageStatus(task.status))
    throw new PrCenterError(
      "This task is not awaiting approval",
      422,
      "INVALID_TRANSITION",
    );
  const revision = task.revisions[0];
  if (!revision)
    throw new PrCenterError(
      "A task revision is required before approval",
      422,
      "REVISION_REQUIRED",
    );
  const policy = loadApprovalPolicy();
  const stage = getApprovalStage(policy, task.status);
  if (!stage)
    throw new PrCenterError(
      "This stage is not required by the approved approval policy",
      409,
      "APPROVAL_STAGE_NOT_CONFIGURED",
    );
  if (
    !hasApprovalAuthority({
      stage,
      roleGrants: actorRoleGrants(actor),
      taskDepartmentId: task.request.departmentId,
    })
  )
    throw new PrCenterError(
      "You are not authorized for this approval stage or department scope",
      403,
      "APPROVAL_AUTHORITY_MISMATCH",
    );
  if (input.decision !== "APPROVED" && !input.comment?.trim())
    throw new PrCenterError(
      "A reason is required for revision or rejection decisions",
      422,
      "REASON_REQUIRED",
    );
  const priorStageDecision = await prisma.prApproval.findFirst({
    where: {
      taskId: task.id,
      taskRevision: revision.revisionNumber,
      stage: task.status,
    },
    select: { id: true },
  });
  if (priorStageDecision)
    throw new PrCenterError(
      "A decision already exists for this stage and revision",
      409,
      "APPROVAL_ALREADY_RECORDED",
    );
  const next =
    input.decision === "APPROVED"
      ? (getNextApprovalStage(policy, stage.status)?.status ?? "APPROVED")
      : input.decision;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.prTask.updateMany({
      where: { id: task.id, version: fromVersion },
      data: { status: next, version: { increment: 1 } },
    });
    if (updated.count !== 1)
      throw new PrCenterError(
        "This task has changed. Refresh and try again.",
        409,
        "STALE_UPDATE",
      );
    const approval = await tx.prApproval.create({
      data: {
        taskId: task.id,
        taskRevision: revision.revisionNumber,
        stage: task.status,
        decision: input.decision as PrApprovalDecision,
        comment: input.comment?.trim() || null,
        decidedById: actor.id,
      },
    });
    await tx.prStatusHistory.create({
      data: {
        taskId: task.id,
        fromState: task.status,
        toState: next,
        reason: input.comment?.trim() || null,
        actorId: actor.id,
      },
    });
    await auditAndOutbox(tx, {
      actor,
      action: "approval.recorded",
      entityType: "task",
      entityId: task.id,
      after: {
        decision: input.decision,
        revision: revision.revisionNumber,
        version: fromVersion + 1,
        approvalPolicyVersion: policy.version,
        approvalReference: policy.approvalReference,
        stage: stage.status,
        authorityRoles: actorRoleGrants(actor).map((grant) => ({
          role: grant.role,
          departmentId: grant.departmentId,
        })),
      },
      eventType: "pr.approval.recorded",
      correlationId,
    });
    return approval;
  });
}

export async function listAssignableUsers(actor: PrCenterActor) {
  if (!canManageTasks(actorRoles(actor)))
    throw new PrCenterError("You cannot view assignable users", 403, "FORBIDDEN");
  const ownerScope = roleDepartmentScopes(actor, [
    "PR_OPERATIONS",
    "SCOPED_ADMINISTRATOR",
  ]);
  return prisma.prCenterUser.findMany({
    where: {
      organizationId: actor.organizationId,
      active: true,
      ...(!ownerScope.organizationWide
        ? { departmentId: { in: ownerScope.departmentIds } }
        : {}),
    },
    select: {
      id: true,
      displayName: true,
      department: { select: { name: true } },
    },
    orderBy: { displayName: "asc" },
  });
}

export async function listCalendarEntries(actor: PrCenterActor, from: Date, to: Date) {
  const rangeMilliseconds = to.getTime() - from.getTime();
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    rangeMilliseconds <= 0 ||
    rangeMilliseconds > 45 * 24 * 60 * 60 * 1000
  ) {
    throw new PrCenterError(
      "Calendar range must be valid and no longer than 45 days",
      422,
      "INVALID_CALENDAR_RANGE",
    );
  }

  const requestScope = requestScopeWhere(actor);
  const [schedules, drafts] = await Promise.all([
    prisma.prSchedule.findMany({
      where: {
        OR: [
          { scheduledFor: { gte: from, lt: to }, publishedAt: null },
          { publishedAt: { gte: from, lt: to } },
        ],
        task: { request: requestScope },
      },
      select: {
        id: true,
        taskId: true,
        channel: true,
        taskRevision: true,
        scheduledFor: true,
        publishedAt: true,
        publishedUrl: true,
        publishedReference: true,
        task: {
          select: {
            title: true,
            request: { select: { requestNumber: true } },
          },
        },
      },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
    }),
    prisma.prTask.findMany({
      where: {
        status: "DRAFT",
        dueAt: { gte: from, lt: to },
        request: requestScope,
      },
      select: {
        id: true,
        title: true,
        contentType: true,
        dueAt: true,
        request: { select: { requestNumber: true } },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return [
    ...schedules.map((schedule) => ({
      id: schedule.id,
      taskId: schedule.taskId,
      title: schedule.task.title,
      requestNumber: schedule.task.request.requestNumber,
      channel: schedule.channel,
      taskRevision: schedule.taskRevision,
      date: schedule.publishedAt ?? schedule.scheduledFor,
      status: schedule.publishedAt ? ("PUBLISHED" as const) : ("SCHEDULED" as const),
      publishedUrl: schedule.publishedUrl,
      publishedReference: schedule.publishedReference,
    })),
    ...drafts.map((task) => ({
      id: task.id,
      taskId: task.id,
      title: task.title,
      requestNumber: task.request.requestNumber,
      channel: null,
      taskRevision: null,
      date: task.dueAt!,
      status: "DRAFT" as const,
      contentType: task.contentType,
    })),
  ].sort((left, right) => left.date.getTime() - right.date.getTime());
}

export async function listCalendarRequestDecisions(
  actor: PrCenterActor,
  from: Date,
  to: Date,
) {
  const rangeMilliseconds = to.getTime() - from.getTime();
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    rangeMilliseconds <= 0 ||
    rangeMilliseconds > 45 * 24 * 60 * 60 * 1000
  )
    throw new PrCenterError(
      "Calendar range must be valid and no longer than 45 days",
      422,
      "INVALID_CALENDAR_RANGE",
    );

  const events = await prisma.prStatusHistory.findMany({
    where: {
      requestId: { not: null },
      toState: { in: ["APPROVED", "REJECTED"] },
      createdAt: { gte: from, lt: to },
      request: { is: requestScopeWhere(actor) },
    },
    select: {
      id: true,
      requestId: true,
      toState: true,
      reason: true,
      actorId: true,
      createdAt: true,
      request: { select: { requestNumber: true, title: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const actorIds = [...new Set(events.map((event) => event.actorId))];
  const actors = actorIds.length
    ? await prisma.prCenterUser.findMany({
        where: { id: { in: actorIds }, organizationId: actor.organizationId },
        select: { id: true, displayName: true },
      })
    : [];
  const actorNames = new Map(actors.map((user) => [user.id, user.displayName]));
  return events.flatMap((event) => {
    if (
      !event.requestId ||
      (event.toState !== "APPROVED" && event.toState !== "REJECTED") ||
      !event.request
    )
      return [];
    return [
      {
        id: event.id,
        requestId: event.requestId,
        requestNumber: event.request.requestNumber,
        title: event.request.title,
        decision: event.toState,
        reason: event.reason,
        actorName: actorNames.get(event.actorId) || "Unknown user",
        date: event.createdAt.toISOString(),
      },
    ];
  });
}

export async function listTaskSchedules(actor: PrCenterActor, taskId: string) {
  if (!canManageTasks(actorRoles(actor)))
    throw new PrCenterError("You cannot view task schedules", 403, "FORBIDDEN");
  const task = await prisma.prTask.findFirst({
    where: taskScopeWhere(actor, taskId),
    select: { id: true },
  });
  if (!task) throw new PrCenterError("Task not found", 404, "NOT_FOUND");
  return prisma.prSchedule.findMany({
    where: { taskId, publishedAt: null },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
  });
}

export async function scheduleTask(
  actor: PrCenterActor,
  taskId: string,
  fromVersion: number,
  input: { channel: string; scheduledFor: Date; idempotencyKey: string },
  correlationId: string = randomUUID(),
) {
  if (!canManageTasks(actorRoles(actor)))
    throw new PrCenterError("You cannot schedule this task", 403, "FORBIDDEN");
  const channel = input.channel.trim();
  const idempotencyKey = input.idempotencyKey.trim();
  if (!channel || channel.length > 100)
    throw new PrCenterError("A publication channel is required", 422, "INVALID_CHANNEL");
  if (Number.isNaN(input.scheduledFor.getTime()))
    throw new PrCenterError("Schedule time is invalid", 422, "INVALID_SCHEDULE");
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128)
    throw new PrCenterError("Idempotency key is invalid", 422, "INVALID_IDEMPOTENCY_KEY");
  const task = await prisma.prTask.findFirst({
    where: taskScopeWhere(actor, taskId),
    include: {
      request: { include: { sources: true } },
      revisions: { orderBy: { revisionNumber: "desc" }, take: 1 },
    },
  });
  if (!task) throw new PrCenterError("Task not found", 404, "NOT_FOUND");
  const currentRevision = task.revisions[0]?.revisionNumber ?? 1;
  const existing = await prisma.prSchedule.findUnique({ where: { idempotencyKey } });
  if (existing) {
    if (
      existing.taskId !== taskId ||
      existing.channel !== channel ||
      existing.scheduledFor.getTime() !== input.scheduledFor.getTime() ||
      existing.taskRevision !== currentRevision
    )
      throw new PrCenterError(
        "Idempotency key is already in use with different parameters",
        409,
        "IDEMPOTENCY_CONFLICT",
      );
    return { ...existing, taskVersion: task.version };
  }
  if (task.version !== fromVersion)
    throw new PrCenterError(
      "This task has changed. Refresh and try again.",
      409,
      "STALE_UPDATE",
    );
  const duplicateChannelSchedule = await prisma.prSchedule.findFirst({
    where: { taskId, channel, taskRevision: currentRevision },
  });
  if (duplicateChannelSchedule)
    throw new PrCenterError(
      "This task already has a schedule for this channel and revision",
      409,
      "CHANNEL_SCHEDULE_EXISTS",
    );
  if (task.status !== "APPROVED" && task.status !== "SCHEDULED")
    throw new PrCenterError(
      "Only an approved or already-scheduled task can receive a channel schedule",
      422,
      "INVALID_TRANSITION",
    );
  const firstSchedule = task.status === "APPROVED";
  const revision = task.revisions[0];
  const cleanFinalAsset = revision?.finalAssetId
    ? Boolean(
        await prisma.prFileObject.findFirst({
          where: { id: revision.finalAssetId, scanStatus: "CLEAN" },
          select: { id: true },
        }),
      )
    : false;
  const missing = publicationGate({
    approved: task.status === "APPROVED" || task.status === "SCHEDULED",
    ownerId: task.ownerId,
    channel,
    hasSource: task.request.sources.length > 0,
    hasKeyMessage: Boolean(revision?.keyMessage?.trim()),
    hasCleanFinalAsset: cleanFinalAsset,
    scheduledFor: input.scheduledFor,
  });
  if (missing.length)
    throw new PrCenterError(
      `Publication gate is incomplete: ${missing.join(", ")}`,
      422,
      "PUBLICATION_GATE_INCOMPLETE",
    );
  return prisma.$transaction(async (tx) => {
    const updated = await tx.prTask.updateMany({
      where: {
        id: task.id,
        version: fromVersion,
        status: task.status,
      },
      data: {
        ...(firstSchedule ? { status: "SCHEDULED" as const } : {}),
        channel,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1)
      throw new PrCenterError(
        "This task has changed. Refresh and try again.",
        409,
        "STALE_UPDATE",
      );
    const schedule = await tx.prSchedule.create({
      data: {
        taskId: task.id,
        channel,
        taskRevision: currentRevision,
        scheduledFor: input.scheduledFor,
        idempotencyKey,
      },
    });
    if (firstSchedule)
      await tx.prStatusHistory.create({
        data: {
          taskId: task.id,
          fromState: "APPROVED",
          toState: "SCHEDULED",
          actorId: actor.id,
        },
      });
    await auditAndOutbox(tx, {
      actor,
      action: firstSchedule ? "task.scheduled" : "task.channel_scheduled",
      entityType: "task",
      entityId: task.id,
      after: {
        scheduleId: schedule.id,
        channel,
        taskRevision: currentRevision,
        scheduledFor: input.scheduledFor.toISOString(),
        version: fromVersion + 1,
      },
      eventType: firstSchedule ? "pr.task.scheduled" : "pr.task.channel_scheduled",
      correlationId,
    });
    return { ...schedule, taskVersion: fromVersion + 1 };
  });
}

export async function recordPublishingEvidence(
  actor: PrCenterActor,
  taskId: string,
  fromVersion: number,
  input: { publishedUrl: string; publishedReference: string; channel?: string },
  correlationId: string = randomUUID(),
) {
  if (!canManageTasks(actorRoles(actor)))
    throw new PrCenterError("You cannot publish this task", 403, "FORBIDDEN");
  const publishedUrl = assertUrl(input.publishedUrl.trim());
  const publishedReference = input.publishedReference.trim();
  if (!publishedReference || publishedReference.length > 300)
    throw new PrCenterError(
      "A publication reference is required",
      422,
      "INVALID_PUBLICATION_EVIDENCE",
    );
  const task = await prisma.prTask.findFirst({
    where: taskScopeWhere(actor, taskId),
    include: {
      schedules: {
        where: {
          publishedAt: null,
          ...(input.channel?.trim() ? { channel: input.channel.trim() } : {}),
        },
        orderBy: { scheduledFor: "desc" },
      },
    },
  });
  if (!task) throw new PrCenterError("Task not found", 404, "NOT_FOUND");
  if (task.version !== fromVersion)
    throw new PrCenterError(
      "This task has changed. Refresh and try again.",
      409,
      "STALE_UPDATE",
    );
  const schedule = task.schedules[0];
  if (!schedule || (task.status !== "SCHEDULED" && task.status !== "PUBLISHED"))
    throw new PrCenterError(
      "This task has no pending schedule for that channel",
      422,
      "INVALID_TRANSITION",
    );
  const firstPublication = task.status === "SCHEDULED";
  return prisma.$transaction(async (tx) => {
    if (firstPublication) {
      const updated = await tx.prTask.updateMany({
        where: { id: task.id, version: fromVersion, status: "SCHEDULED" },
        data: { status: "PUBLISHED", version: { increment: 1 } },
      });
      if (updated.count !== 1)
        throw new PrCenterError(
          "This task has changed. Refresh and try again.",
          409,
          "STALE_UPDATE",
        );
    }
    const publishedAt = new Date();
    const evidence = await tx.prSchedule.updateMany({
      where: { id: schedule.id, publishedAt: null },
      data: { publishedUrl, publishedReference, publishedAt },
    });
    if (evidence.count !== 1)
      throw new PrCenterError(
        "Publication evidence was already recorded",
        409,
        "STALE_UPDATE",
      );
    if (firstPublication)
      await tx.prStatusHistory.create({
        data: {
          taskId: task.id,
          fromState: "SCHEDULED",
          toState: "PUBLISHED",
          actorId: actor.id,
        },
      });
    await auditAndOutbox(tx, {
      actor,
      action: firstPublication ? "task.published" : "task.publication_evidence_recorded",
      entityType: "task",
      entityId: task.id,
      after: {
        scheduleId: schedule.id,
        channel: schedule.channel,
        taskRevision: schedule.taskRevision,
        publishedUrl,
        publishedReference,
        publishedAt: publishedAt.toISOString(),
        version: firstPublication ? fromVersion + 1 : fromVersion,
      },
      eventType: firstPublication
        ? "pr.task.published"
        : "pr.task.publication_evidence_recorded",
      correlationId,
    });
    return {
      id: schedule.id,
      publishedUrl,
      publishedReference,
      publishedAt,
      taskVersion: firstPublication ? fromVersion + 1 : fromVersion,
    };
  });
}

// ── File scanning (mock) ────────────────────────────────────────────────

type ScanResult = "CLEAN" | "QUARANTINED" | "FAILED";

async function scanFile(
  content: Buffer,
): Promise<{ result: ScanResult; reason: string }> {
  try {
    const scan = await scanWithClamAv(content);
    return {
      result: scan.status,
      reason:
        scan.status === "CLEAN"
          ? "ClamAV scan passed"
          : `ClamAV detected ${scan.signature || "malware"}`,
    };
  } catch {
    return {
      result: "FAILED",
      reason: "ClamAV unavailable or scan failed; file remains quarantined",
    };
  }
}

// ── File upload, download, attachment, and final-asset helpers ──────────────

export async function uploadFile(
  actor: PrCenterActor,
  input: {
    fileName: string;
    mimeType: string;
    content: Buffer;
  },
  correlationId: string = randomUUID(),
) {
  if (!canAttachFiles(actorRoles(actor)))
    throw new PrCenterError("You cannot upload files", 403, "FORBIDDEN");
  let stored: StoredFile;
  try {
    stored = await storeFile(actor.organizationId, input);
  } catch (error) {
    if (error instanceof FileValidationError)
      throw new PrCenterError(error.message, error.statusCode, error.code);
    throw error;
  }
  // Scan before exposing the file; non-clean and failed scans remain undownloadable.
  const scan = await scanFile(input.content);
  return prisma.$transaction(async (tx) => {
    const fileObject = await tx.prFileObject.create({
      data: {
        organizationId: actor.organizationId,
        storageKey: stored.storageKey,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        checksum: stored.checksum,
        scanStatus: scan.result,
        scannedAt: new Date(),
      },
    });
    // Audit: file uploaded
    await tx.prAuditEvent.create({
      data: {
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: "file.uploaded",
        entityType: "file",
        entityId: fileObject.id,
        correlationId,
        after: {
          fileName: stored.fileName,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          checksum: stored.checksum,
          scanStatus: scan.result,
        },
      },
    });
    // Audit: scan result (always record scan outcome)
    await tx.prAuditEvent.create({
      data: {
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: "file.scan_completed",
        entityType: "file",
        entityId: fileObject.id,
        correlationId,
        after: {
          scanStatus: scan.result,
          reason: scan.reason,
        },
      },
    });
    return fileObject;
  });
}

export async function downloadFile(
  actor: PrCenterActor,
  fileId: string,
): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
  const fileObject = await prisma.prFileObject.findFirst({
    where: { id: fileId, organizationId: actor.organizationId, deletedAt: null },
  });
  if (!fileObject) throw new PrCenterError("File not found", 404, "NOT_FOUND");
  // Only allow download of clean files.
  if (fileObject.scanStatus !== "CLEAN")
    throw new PrCenterError(
      "This file is not yet available for download",
      423,
      "FILE_NOT_AVAILABLE",
    );
  // Verify the file is linked to a request/task the actor may access.
  const attachment = await prisma.prAttachment.findFirst({
    where: { fileId },
    include: {
      request: {
        select: { organizationId: true, departmentId: true, requesterId: true },
      },
      task: {
        select: {
          request: {
            select: { organizationId: true, departmentId: true, requesterId: true },
          },
        },
      },
    },
  });
  if (!attachment) throw new PrCenterError("File not found", 404, "NOT_FOUND");
  const linkedRequests = [attachment.request, attachment.task?.request].filter(
    (request): request is NonNullable<typeof request> => Boolean(request),
  );
  if (
    linkedRequests.length === 0 ||
    linkedRequests.some((request) => request.organizationId !== actor.organizationId)
  )
    throw new PrCenterError("File not found", 404, "NOT_FOUND");
  if (!linkedRequests.every((request) => canReadRequestRecord(actor, request)))
    throw new PrCenterError("You cannot access this file", 403, "FORBIDDEN");
  const buffer = await readFileFromStorage(actor.organizationId, fileObject.storageKey);
  return { buffer, fileName: fileObject.fileName, mimeType: fileObject.mimeType };
}

export async function createAttachment(
  actor: PrCenterActor,
  input: {
    fileId: string;
    requestId?: string;
    taskId?: string;
    kind: string;
  },
  correlationId: string = randomUUID(),
) {
  if (!canAttachFiles(actorRoles(actor)))
    throw new PrCenterError("You cannot attach files", 403, "FORBIDDEN");
  if (!input.requestId && !input.taskId)
    throw new PrCenterError(
      "An attachment must be linked to a request or task",
      422,
      "INVALID_ATTACHMENT_TARGET",
    );
  const kind = input.kind.trim();
  if (!kind || kind.length > 100)
    throw new PrCenterError(
      "Attachment kind is required (max 100 characters)",
      422,
      "INVALID_KIND",
    );
  const fileObject = await prisma.prFileObject.findFirst({
    where: {
      id: input.fileId,
      organizationId: actor.organizationId,
      scanStatus: "CLEAN",
      deletedAt: null,
    },
  });
  if (!fileObject)
    throw new PrCenterError("File not found or not yet available", 404, "FILE_NOT_FOUND");
  // Authorize scope.
  if (input.requestId) {
    const request = await prisma.prRequest.findFirst({
      where: { id: input.requestId, ...requestScopeWhere(actor) },
    });
    if (!request) throw new PrCenterError("Request not found", 404, "NOT_FOUND");
  }
  if (input.taskId) {
    const task = await prisma.prTask.findFirst({
      where: taskScopeWhere(actor, input.taskId),
    });
    if (!task) throw new PrCenterError("Task not found", 404, "NOT_FOUND");
  }
  return prisma.$transaction(async (tx) => {
    // Auto-increment version when replacing evidence for same target+kind
    const where: Record<string, unknown> = { kind };
    if (input.taskId) where.taskId = input.taskId;
    if (input.requestId) where.requestId = input.requestId;
    const latest = await tx.prAttachment.findFirst({
      where,
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;
    const attachment = await tx.prAttachment.create({
      data: {
        requestId: input.requestId || null,
        taskId: input.taskId || null,
        fileId: input.fileId,
        kind,
        version: nextVersion,
      },
      include: { file: true },
    });
    await tx.prAuditEvent.create({
      data: {
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: "attachment.created",
        entityType: "attachment",
        entityId: attachment.id,
        correlationId,
        after: {
          fileId: input.fileId,
          requestId: input.requestId || null,
          taskId: input.taskId || null,
          kind,
        },
      },
    });
    return attachment;
  });
}

export async function listAttachments(
  actor: PrCenterActor,
  input: { requestId?: string; taskId?: string },
) {
  if (!input.requestId && !input.taskId)
    throw new PrCenterError("Provide a requestId or taskId", 422, "INVALID_FILTER");
  // Authorize scope.
  if (input.requestId) {
    const request = await prisma.prRequest.findFirst({
      where: { id: input.requestId, ...requestScopeWhere(actor) },
    });
    if (!request) throw new PrCenterError("Request not found", 404, "NOT_FOUND");
  }
  if (input.taskId) {
    const task = await prisma.prTask.findFirst({
      where: taskScopeWhere(actor, input.taskId),
    });
    if (!task) throw new PrCenterError("Task not found", 404, "NOT_FOUND");
  }
  return prisma.prAttachment.findMany({
    where: {
      ...(input.requestId ? { requestId: input.requestId } : {}),
      ...(input.taskId ? { taskId: input.taskId } : {}),
    },
    include: {
      file: {
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          checksum: true,
          scanStatus: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function removeAttachment(
  actor: PrCenterActor,
  attachmentId: string,
  correlationId: string = randomUUID(),
) {
  if (!canRemoveAttachment(actorRoles(actor)))
    throw new PrCenterError("You cannot remove attachments", 403, "FORBIDDEN");
  const attachment = await prisma.prAttachment.findFirst({
    where: { id: attachmentId },
    include: {
      request: { select: { organizationId: true } },
      task: {
        select: { request: { select: { organizationId: true } } },
      },
    },
  });
  if (!attachment) throw new PrCenterError("Attachment not found", 404, "NOT_FOUND");
  const orgId =
    attachment.request?.organizationId ?? attachment.task?.request.organizationId;
  if (orgId !== actor.organizationId)
    throw new PrCenterError("Attachment not found", 404, "NOT_FOUND");
  return prisma.$transaction(async (tx) => {
    await tx.prAttachment.delete({ where: { id: attachmentId } });
    // Check if the file is orphaned (no remaining attachments)
    const remainingAttachments = await tx.prAttachment.count({
      where: { fileId: attachment.fileId },
    });
    let fileRemoved = false;
    if (remainingAttachments === 0) {
      // Soft-delete the orphaned file object
      await tx.prFileObject.update({
        where: { id: attachment.fileId },
        data: { deletedAt: new Date() },
      });
      fileRemoved = true;
    }
    await tx.prAuditEvent.create({
      data: {
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: "attachment.removed",
        entityType: "attachment",
        entityId: attachmentId,
        correlationId,
        after: {
          fileId: attachment.fileId,
          requestId: attachment.requestId,
          taskId: attachment.taskId,
          kind: attachment.kind,
          orphanedFileCleanedUp: fileRemoved,
        },
      },
    });
    return { id: attachmentId, removed: true, orphanedFileCleanedUp: fileRemoved };
  });
}

export async function assignFinalAsset(
  actor: PrCenterActor,
  taskIdArg: string,
  fromVersion: number,
  input: { fileId: string; revisionNumber?: number },
  correlationId: string = randomUUID(),
) {
  if (!canAssignFinalAsset(actorRoles(actor)))
    throw new PrCenterError("You cannot assign final assets", 403, "FORBIDDEN");
  const task = await prisma.prTask.findFirst({
    where: taskScopeWhere(actor, taskIdArg),
    include: { revisions: { orderBy: { revisionNumber: "desc" }, take: 1 } },
  });
  if (!task) throw new PrCenterError("Task not found", 404, "NOT_FOUND");
  if (task.version !== fromVersion)
    throw new PrCenterError(
      "This task has changed. Refresh and try again.",
      409,
      "STALE_UPDATE",
    );
  const fileObject = await prisma.prFileObject.findFirst({
    where: {
      id: input.fileId,
      organizationId: actor.organizationId,
      scanStatus: "CLEAN",
      deletedAt: null,
    },
  });
  if (!fileObject)
    throw new PrCenterError("File not found or not yet clean", 404, "FILE_NOT_FOUND");
  const attachment = await prisma.prAttachment.findFirst({
    where: {
      taskId: task.id,
      fileId: fileObject.id,
      file: {
        organizationId: actor.organizationId,
        scanStatus: "CLEAN",
        deletedAt: null,
      },
    },
    select: { id: true },
  });
  if (!attachment)
    throw new PrCenterError(
      "Final assets must be clean files attached to this task",
      422,
      "FINAL_ASSET_NOT_ATTACHED",
    );
  const revision = task.revisions[0];
  if (!revision)
    throw new PrCenterError(
      "A task revision is required before assigning a final asset",
      422,
      "REVISION_REQUIRED",
    );
  const targetRevisionNumber = input.revisionNumber ?? revision.revisionNumber;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.prTaskRevision.updateMany({
      where: {
        taskId: task.id,
        revisionNumber: targetRevisionNumber,
      },
      data: { finalAssetId: fileObject.id },
    });
    if (updated.count !== 1)
      throw new PrCenterError("Task revision not found", 404, "REVISION_NOT_FOUND");
    await tx.prAuditEvent.create({
      data: {
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: "task.final_asset_assigned",
        entityType: "task",
        entityId: task.id,
        correlationId,
        after: {
          fileId: fileObject.id,
          revisionNumber: targetRevisionNumber,
        },
      },
    });
    return {
      taskId: task.id,
      revisionNumber: targetRevisionNumber,
      fileId: fileObject.id,
    };
  });
}

// ── Notification policy evaluation (admin/system trigger) ────────────────

export async function evaluateNotificationReminders(
  actor: PrCenterActor,
): Promise<
  PolicyEvaluationResult & { channelResults: Array<{ channel: string; status: string }> }
> {
  if (!actorHasOrganizationWideRole(actor, ["SCOPED_ADMINISTRATOR"]))
    throw new PrCenterError(
      "Only administrators can trigger reminder evaluation",
      403,
      "FORBIDDEN",
    );

  const result = await evaluateNotificationPolicy();

  // Dispatch through external channels for newly created notifications
  const channelResults: Array<{ channel: string; status: string }> = [];
  if (result.totalNotificationsCreated > 0) {
    const recipient = await prisma.prCenterUser.findFirst({
      where: { id: actor.id, organizationId: actor.organizationId, active: true },
      select: { email: true },
    });
    // We dispatch a summary notification through channels for operational evidence.
    const dispatches = await dispatchNotification({
      userId: actor.id,
      title: "[SYSTEM] Reminder evaluation completed",
      body: `Created ${result.totalNotificationsCreated} notifications: ${result.dueRemindersCreated} due, ${result.overdueRemindersCreated} overdue, ${result.mandatoryRemindersCreated} mandatory.`,
      target: "system-data",
      recipientAddress: recipient?.email,
    });
    for (const d of dispatches) {
      channelResults.push({ channel: d.channel, status: d.status });
    }
  }

  return { ...result, channelResults };
}

// ── Access Administration (SCOPED_ADMINISTRATOR only) ────────────────────

async function assertActiveOrganizationAdministratorRemains(
  tx: Prisma.TransactionClient,
  organizationId: string,
  excluded: { roleId?: string; userId?: string },
) {
  const remaining = await tx.prUserRole.count({
    where: {
      organizationId,
      role: "SCOPED_ADMINISTRATOR",
      departmentId: null,
      user: { active: true },
      ...(excluded.roleId ? { id: { not: excluded.roleId } } : {}),
      ...(excluded.userId ? { userId: { not: excluded.userId } } : {}),
    },
  });
  if (remaining === 0)
    throw new PrCenterError(
      "At least one active organization-wide administrator must remain",
      422,
      "LAST_ORGANIZATION_ADMIN",
    );
}

async function runSerializableAccessTransaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  try {
    return await prisma.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    )
      throw new PrCenterError(
        "Access changed concurrently. Refresh and try again.",
        409,
        "STALE_ACCESS_ADMIN_WRITE",
      );
    throw error;
  }
}

export async function listAdminUsers(actor: PrCenterActor) {
  if (!canManageAccess(actorRoles(actor)))
    throw new PrCenterError("You cannot view user directory", 403, "FORBIDDEN");
  const adminScope = roleDepartmentScopes(actor, ["SCOPED_ADMINISTRATOR"]);
  return prisma.prCenterUser.findMany({
    where: {
      organizationId: actor.organizationId,
      ...(!adminScope.organizationWide
        ? { departmentId: { in: adminScope.departmentIds } }
        : {}),
    },
    include: {
      department: { select: { id: true, name: true } },
      roles: {
        ...(!adminScope.organizationWide
          ? {
              where: {
                OR: [
                  { departmentId: { in: adminScope.departmentIds } },
                  { departmentId: null },
                ],
              },
            }
          : {}),
        select: { id: true, role: true, departmentId: true },
      },
    },
    orderBy: { displayName: "asc" },
  });
}

function normalizeAccessAdminReason(reason: unknown): string {
  if (typeof reason !== "string" || !reason.trim())
    throw new PrCenterError(
      "A reason is required for access administration changes",
      422,
      "REASON_REQUIRED",
    );
  const normalized = reason.trim();
  if (normalized.length > 1000)
    throw new PrCenterError(
      "Access administration reason is too long",
      422,
      "INVALID_REASON",
    );
  return normalized;
}

export async function grantRole(
  actor: PrCenterActor,
  userId: string,
  role: PrCenterRole,
  departmentId: string | null,
  reason: unknown,
  correlationId: string = randomUUID(),
) {
  if (!canManageAccess(actorRoles(actor)))
    throw new PrCenterError("You cannot grant roles", 403, "FORBIDDEN");
  if (!PR_CENTER_ROLES.includes(role))
    throw new PrCenterError("Invalid role code", 422, "INVALID_ROLE");
  if (role === "SCOPED_ADMINISTRATOR" && !actor.isRootAdministrator)
    throw new PrCenterError(
      "Only the root PR Center administrator can grant administrator roles",
      403,
      "ROOT_ADMIN_REQUIRED",
    );
  if (userId === actor.id)
    throw new PrCenterError(
      "You cannot grant roles to your own account",
      422,
      "SELF_GRANT_BLOCKED",
    );
  const accessReason = normalizeAccessAdminReason(reason);
  assertCanManageDepartmentScope(actor, departmentId ?? null);
  const user = await prisma.prCenterUser.findFirst({
    where: { id: userId, organizationId: actor.organizationId },
  });
  if (!user) throw new PrCenterError("User not found", 404, "NOT_FOUND");
  assertCanManageUserScope(actor, user);
  if (departmentId) {
    const dept = await prisma.prDepartment.findFirst({
      where: { id: departmentId, organizationId: actor.organizationId },
    });
    if (!dept)
      throw new PrCenterError("Department not found", 404, "DEPARTMENT_NOT_FOUND");
  }
  const existing = await prisma.prUserRole.findFirst({
    where: {
      userId,
      role,
      organizationId: actor.organizationId,
      departmentId: departmentId ?? null,
    },
  });
  if (existing)
    throw new PrCenterError(
      "User already has this role in this scope",
      409,
      "ROLE_ALREADY_ASSIGNED",
    );
  return prisma.$transaction(async (tx) => {
    const granted = await tx.prUserRole.create({
      data: {
        userId,
        role,
        organizationId: actor.organizationId,
        departmentId: departmentId ?? null,
      },
    });
    await tx.prAuditEvent.create({
      data: {
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: "access.role_granted",
        entityType: "user",
        entityId: userId,
        correlationId,
        after: {
          roleId: granted.id,
          role,
          departmentId: departmentId ?? null,
          reason: accessReason,
          authorityRoles: actorRoleGrants(actor),
        },
      },
    });
    return granted;
  });
}

export async function revokeRole(
  actor: PrCenterActor,
  roleId: string,
  reason: unknown,
  correlationId: string = randomUUID(),
) {
  if (!canManageAccess(actorRoles(actor)))
    throw new PrCenterError("You cannot revoke roles", 403, "FORBIDDEN");
  const accessReason = normalizeAccessAdminReason(reason);
  const roleRecord = await prisma.prUserRole.findFirst({
    where: { id: roleId, organizationId: actor.organizationId },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
          departmentId: true,
          active: true,
        },
      },
    },
  });
  if (!roleRecord) throw new PrCenterError("Role assignment not found", 404, "NOT_FOUND");
  if (roleRecord.role === "SCOPED_ADMINISTRATOR" && !actor.isRootAdministrator)
    throw new PrCenterError(
      "Only the root PR Center administrator can revoke administrator roles",
      403,
      "ROOT_ADMIN_REQUIRED",
    );
  if (isRootPrCenterAdministrator(roleRecord.user.email))
    throw new PrCenterError(
      "The root PR Center administrator assignment is protected",
      422,
      "ROOT_ADMIN_PROTECTED",
    );
  assertCanManageDepartmentScope(actor, roleRecord.departmentId);
  assertCanManageUserScope(actor, roleRecord.user);
  return runSerializableAccessTransaction(async (tx) => {
    if (
      roleRecord.role === "SCOPED_ADMINISTRATOR" &&
      roleRecord.departmentId === null &&
      roleRecord.user.active
    )
      await assertActiveOrganizationAdministratorRemains(tx, actor.organizationId, {
        roleId,
      });
    await tx.prUserRole.delete({ where: { id: roleId } });
    await tx.prAuditEvent.create({
      data: {
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: "access.role_revoked",
        entityType: "user",
        entityId: roleRecord.userId,
        correlationId,
        before: {
          roleId,
          role: roleRecord.role,
          departmentId: roleRecord.departmentId,
          reason: accessReason,
          authorityRoles: actorRoleGrants(actor),
        },
      },
    });
    return { id: roleId, removed: true };
  });
}

export async function toggleUserActive(
  actor: PrCenterActor,
  userId: string,
  reason: unknown,
  correlationId: string = randomUUID(),
) {
  if (!canManageAccess(actorRoles(actor)))
    throw new PrCenterError("You cannot modify user status", 403, "FORBIDDEN");
  const accessReason = normalizeAccessAdminReason(reason);
  const user = await prisma.prCenterUser.findFirst({
    where: { id: userId, organizationId: actor.organizationId },
    include: { roles: { select: { role: true, departmentId: true } } },
  });
  if (!user) throw new PrCenterError("User not found", 404, "NOT_FOUND");
  assertCanManageUserScope(actor, user);
  if (isRootPrCenterAdministrator(user.email))
    throw new PrCenterError(
      "The root PR Center administrator account cannot be deactivated",
      422,
      "ROOT_ADMIN_PROTECTED",
    );
  if (
    !actor.isRootAdministrator &&
    user.roles?.some((grant) => grant.role === "SCOPED_ADMINISTRATOR")
  )
    throw new PrCenterError(
      "Only the root PR Center administrator can change another administrator's active status",
      403,
      "ROOT_ADMIN_REQUIRED",
    );
  if (user.id === actor.id)
    throw new PrCenterError(
      "You cannot deactivate yourself",
      422,
      "SELF_DEACTIVATION_BLOCKED",
    );
  const nextActive = !user.active;
  return runSerializableAccessTransaction(async (tx) => {
    if (!nextActive) {
      const orgAdminGrant = await tx.prUserRole.findFirst({
        where: {
          userId,
          organizationId: actor.organizationId,
          role: "SCOPED_ADMINISTRATOR",
          departmentId: null,
        },
        select: { id: true },
      });
      if (orgAdminGrant)
        await assertActiveOrganizationAdministratorRemains(tx, actor.organizationId, {
          userId,
        });
    }
    const updated = await tx.prCenterUser.update({
      where: { id: userId },
      data: { active: nextActive },
    });
    await tx.prAuditEvent.create({
      data: {
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: nextActive ? "access.user_activated" : "access.user_deactivated",
        entityType: "user",
        entityId: userId,
        correlationId,
        before: { active: user.active, authorityRoles: actorRoleGrants(actor) },
        after: {
          active: nextActive,
          reason: accessReason,
          authorityRoles: actorRoleGrants(actor),
        },
      },
    });
    return { id: userId, active: updated.active };
  });
}

export async function listAccessAuditEvents(actor: PrCenterActor, take = 100) {
  if (!canManageAccess(actorRoles(actor)))
    throw new PrCenterError("You cannot view access audit events", 403, "FORBIDDEN");
  const limit = Math.min(Math.max(take, 1), 500);
  const organizationWide = actorHasOrganizationWideRole(actor, ["SCOPED_ADMINISTRATOR"]);
  return prisma.prAuditEvent.findMany({
    where: {
      organizationId: actor.organizationId,
      ...(!organizationWide ? { actorId: actor.id } : {}),
      action: {
        in: [
          "access.role_granted",
          "access.role_revoked",
          "access.user_activated",
          "access.user_deactivated",
          "auth.oidc_login",
        ],
      },
    },
    include: { actor: { select: { displayName: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// ── Quarantine management (SCOPED_ADMINISTRATOR + PR_OPERATIONS) ───────────

export async function listQuarantinedFiles(actor: PrCenterActor, take = 50) {
  if (!canManageQuarantine(actorRoles(actor)))
    throw new PrCenterError("You cannot review quarantined files", 403, "FORBIDDEN");
  const limit = Math.min(Math.max(take, 1), 100);
  const scope = quarantinedFileScope(actor);
  return prisma.prFileObject.findMany({
    where: {
      organizationId: actor.organizationId,
      scanStatus: { in: ["QUARANTINED", "FAILED"] },
      deletedAt: null,
      ...scope.fileWhere,
    },
    include: {
      attachments: {
        ...(scope.attachmentWhere ? { where: scope.attachmentWhere } : {}),
        select: {
          id: true,
          kind: true,
          version: true,
          requestId: true,
          taskId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function reviewQuarantinedFile(
  actor: PrCenterActor,
  fileId: string,
  disposition: "approve" | "delete",
  reason: string | undefined,
  correlationId: string = randomUUID(),
) {
  if (!canManageQuarantine(actorRoles(actor)))
    throw new PrCenterError("You cannot review quarantined files", 403, "FORBIDDEN");
  const scope = quarantinedFileScope(actor);
  const fileObject = await prisma.prFileObject.findFirst({
    where: {
      id: fileId,
      organizationId: actor.organizationId,
      scanStatus: { in: ["QUARANTINED", "FAILED"] },
      deletedAt: null,
      ...scope.fileWhere,
    },
  });
  if (!fileObject)
    throw new PrCenterError("Quarantined file not found", 404, "NOT_FOUND");

  if (disposition === "approve")
    throw new PrCenterError(
      "Files must pass ClamAV before they can be downloaded; rescan instead of overriding the result",
      409,
      "FILE_SCAN_REQUIRED",
    );
  if (!reason?.trim())
    throw new PrCenterError("A deletion reason is required", 422, "REASON_REQUIRED");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.prFileObject.update({
      where: { id: fileId },
      data: { deletedAt: new Date() },
    });
    await tx.prAuditEvent.create({
      data: {
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: "file.quarantine_deleted",
        entityType: "file",
        entityId: fileId,
        correlationId,
        before: { scanStatus: fileObject.scanStatus },
        after: {
          deletedAt: updated.deletedAt?.toISOString(),
          reason: reason.trim(),
          authorityRoles: actorRoleGrants(actor),
        },
      },
    });
    return updated;
  });
}

export async function rescanFile(
  actor: PrCenterActor,
  fileId: string,
  correlationId: string = randomUUID(),
) {
  if (!canManageQuarantine(actorRoles(actor)))
    throw new PrCenterError("You cannot rescan files", 403, "FORBIDDEN");
  const scope = quarantinedFileScope(actor);
  const fileObject = await prisma.prFileObject.findFirst({
    where: {
      id: fileId,
      organizationId: actor.organizationId,
      deletedAt: null,
      ...scope.fileWhere,
    },
  });
  if (!fileObject) throw new PrCenterError("File not found", 404, "NOT_FOUND");
  if (fileObject.scanStatus === "CLEAN")
    throw new PrCenterError("File is already clean", 422, "ALREADY_CLEAN");
  if (!fileObject.organizationId)
    throw new PrCenterError("File organization is unknown", 423, "FILE_SCOPE_UNKNOWN");

  const content = await readFileFromStorage(actor.organizationId, fileObject.storageKey);
  const scan = await scanFile(content);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.prFileObject.update({
      where: { id: fileId },
      data: { scanStatus: scan.result, scannedAt: new Date() },
    });
    await tx.prAuditEvent.create({
      data: {
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: "file.scan_completed",
        entityType: "file",
        entityId: fileId,
        correlationId,
        before: { scanStatus: fileObject.scanStatus },
        after: {
          scanStatus: scan.result,
          reason: scan.reason,
          rescan: true,
          authorityRoles: actorRoleGrants(actor),
        },
      },
    });
    return updated;
  });
}

// ── Audit export (SCOPED_ADMINISTRATOR only) ──────────────────────────

export async function exportAuditEvents(
  actor: PrCenterActor,
  filters: {
    from?: string;
    to?: string;
    entityType?: string;
    actorId?: string;
  },
  correlationId: string = randomUUID(),
) {
  if (!actorHasOrganizationWideRole(actor, ["SCOPED_ADMINISTRATOR"]))
    throw new PrCenterError("You cannot export audit events", 403, "FORBIDDEN");
  const where: Prisma.PrAuditEventWhereInput = {
    organizationId: actor.organizationId,
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.actorId ? { actorId: filters.actorId } : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: new Date(filters.from) } : {}),
            ...(filters.to ? { lte: new Date(filters.to) } : {}),
          },
        }
      : {}),
  };
  const events = await prisma.prAuditEvent.findMany({
    where,
    include: { actor: { select: { displayName: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  await prisma.prAuditEvent.create({
    data: {
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: "audit.exported",
      entityType: "audit_export",
      entityId: correlationId,
      correlationId,
      after: { filters, count: events.length, authorityRoles: actorRoleGrants(actor) },
    },
  });
  return {
    exportedAt: new Date().toISOString(),
    filters,
    count: events.length,
    events: events.map((e) => ({
      id: e.id,
      organizationId: e.organizationId,
      actorId: e.actorId,
      actorDisplayName: e.actor?.displayName ?? null,
      actorEmail: e.actor?.email ?? null,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      correlationId: e.correlationId,
      before: e.before,
      after: e.after,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

// ── Restore / compensating-change workflow ────────────────────────────

export async function restoreRequest(
  actor: PrCenterActor,
  requestId: string,
  fromVersion: number,
  reason: string | undefined,
  correlationId: string = randomUUID(),
) {
  if (!canRestoreRequests(actorRoles(actor)))
    throw new PrCenterError("You cannot restore requests", 403, "FORBIDDEN");
  const roleScope = roleDepartmentClauses(actor, ["SCOPED_ADMINISTRATOR"]);
  const restoreScope = { organizationId: actor.organizationId, OR: roleScope };
  const request = await prisma.prRequest.findFirst({
    where: { id: requestId, ...restoreScope },
  });
  if (!request) throw new PrCenterError("Request not found", 404, "NOT_FOUND");
  if (request.status !== "WITHDRAWN" && request.status !== "CANCELLED")
    throw new PrCenterError(
      "Only withdrawn or cancelled requests can be restored",
      422,
      "INVALID_TRANSITION",
    );
  if (request.version !== fromVersion)
    throw new PrCenterError(
      "This request has changed. Refresh and try again.",
      409,
      "STALE_UPDATE",
    );
  return prisma.$transaction(async (tx) => {
    const updated = await tx.prRequest.updateMany({
      where: { id: request.id, version: fromVersion, ...restoreScope },
      data: { status: "DRAFT", version: { increment: 1 } },
    });
    if (updated.count !== 1)
      throw new PrCenterError(
        "This request has changed. Refresh and try again.",
        409,
        "STALE_UPDATE",
      );
    await tx.prStatusHistory.create({
      data: {
        requestId: request.id,
        fromState: request.status,
        toState: "DRAFT",
        reason: reason?.trim() || "Compensating change: request restored",
        actorId: actor.id,
      },
    });
    await auditAndOutbox(tx, {
      actor,
      action: "request.restored",
      entityType: "request",
      entityId: request.id,
      after: {
        previousStatus: request.status,
        newStatus: "DRAFT",
        version: fromVersion + 1,
        reason: reason?.trim() || null,
      },
      eventType: "pr.request.restored",
      correlationId,
    });
    return tx.prRequest.findUniqueOrThrow({ where: { id: request.id } });
  });
}

// ── UAT / release readiness check ────────────────────────────────────

function assertCanManageReleaseEvidence(actor: PrCenterActor) {
  if (!actorHasOrganizationWideRole(actor, ["SCOPED_ADMINISTRATOR"]))
    throw new PrCenterError("You cannot manage release evidence", 403, "FORBIDDEN");
}

function releaseEvidencePayload(value: Prisma.JsonValue): {
  gateKey: ReleaseEvidenceGate;
  result: "PASSED" | "FAILED";
  evidenceReference: string;
  notes: string | null;
  performedAt: string;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, Prisma.JsonValue>;
  if (
    typeof payload.gateKey !== "string" ||
    !RELEASE_EVIDENCE_GATES.includes(payload.gateKey as ReleaseEvidenceGate) ||
    (payload.result !== "PASSED" && payload.result !== "FAILED") ||
    typeof payload.evidenceReference !== "string" ||
    typeof payload.performedAt !== "string"
  )
    return null;
  return {
    gateKey: payload.gateKey as ReleaseEvidenceGate,
    result: payload.result,
    evidenceReference: payload.evidenceReference,
    notes: typeof payload.notes === "string" ? payload.notes : null,
    performedAt: payload.performedAt,
  };
}

export async function listReleaseEvidence(actor: PrCenterActor) {
  assertCanManageReleaseEvidence(actor);
  const events = await prisma.prAuditEvent.findMany({
    where: {
      organizationId: actor.organizationId,
      entityType: "release_evidence",
      action: "release.evidence.recorded",
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      after: true,
      createdAt: true,
      actor: { select: { displayName: true, email: true } },
    },
  });
  return events.flatMap((event) => {
    const evidence = event.after ? releaseEvidencePayload(event.after) : null;
    return evidence
      ? [{ id: event.id, ...evidence, signedAt: event.createdAt, signer: event.actor }]
      : [];
  });
}

export async function recordReleaseEvidence(
  actor: PrCenterActor,
  raw: Record<string, unknown>,
  correlationId: string,
) {
  assertCanManageReleaseEvidence(actor);
  let evidence: ReturnType<typeof parseReleaseEvidenceInput>;
  try {
    evidence = parseReleaseEvidenceInput(raw);
  } catch (error) {
    throw new PrCenterError(
      error instanceof Error ? error.message : "Release evidence is invalid",
      422,
      "INVALID_RELEASE_EVIDENCE",
    );
  }
  const event = await prisma.prAuditEvent.create({
    data: {
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: "release.evidence.recorded",
      entityType: "release_evidence",
      entityId: evidence.gateKey,
      correlationId,
      after: {
        gateKey: evidence.gateKey,
        result: evidence.result,
        evidenceReference: evidence.evidenceReference,
        notes: evidence.notes,
        performedAt: evidence.performedAt.toISOString(),
      },
    },
    select: { id: true, createdAt: true },
  });
  return { id: event.id, ...evidence, signedAt: event.createdAt, signedBy: actor.id };
}

export async function releaseReadinessCheck(actor: PrCenterActor) {
  if (!actorHasOrganizationWideRole(actor, ["SCOPED_ADMINISTRATOR"]))
    throw new PrCenterError("You cannot view release readiness", 403, "FORBIDDEN");
  const org = { organizationId: actor.organizationId };
  const checks: { name: string; passed: boolean; detail: string }[] = [];
  const releaseEvidence = await listReleaseEvidence(actor);
  const latestEvidence = latestReleaseEvidenceByGate(releaseEvidence);
  const addEvidenceCheck = (name: string, gate: ReleaseEvidenceGate) => {
    const evidence = latestEvidence[gate];
    checks.push({
      name,
      passed: evidence?.result === "PASSED",
      detail: evidence
        ? `${evidence.result}; signed by ${evidence.signer?.displayName || "unknown"} at ${evidence.signedAt.toISOString()}; evidence=${evidence.evidenceReference}`
        : "No signed evidence record is available.",
    });
  };

  // 1. Audit trail exists
  const auditCount = await prisma.prAuditEvent.count({ where: org });
  checks.push({
    name: "Audit trail",
    passed: auditCount > 0,
    detail: `${auditCount} audit event(s)`,
  });

  // 2. Request workflow: at least one request in each terminal state
  const withdrawnCount = await prisma.prRequest.count({
    where: { ...org, status: "WITHDRAWN" },
  });
  const closedCount = await prisma.prRequest.count({
    where: { ...org, status: "CLOSED" },
  });
  checks.push({
    name: "Request lifecycle coverage",
    passed: withdrawnCount > 0 && closedCount > 0,
    detail: `withdrawn=${withdrawnCount}, closed=${closedCount}; both outcomes need UAT evidence`,
  });

  // 3. Approval decisions recorded
  const approvalCount = await prisma.prApproval.count({
    where: { task: { request: org } },
  });
  checks.push({
    name: "Approval decisions",
    passed: approvalCount > 0,
    detail: `${approvalCount} approval(s) recorded`,
  });

  // 4. File lifecycle: uploaded, scanned, attached
  const fileScope = { organizationId: actor.organizationId };
  const fileCount = await prisma.prFileObject.count({ where: fileScope });
  const quarantinedCount = await prisma.prFileObject.count({
    where: { ...fileScope, scanStatus: "QUARANTINED" },
  });
  const pendingFileCount = await prisma.prFileObject.count({
    where: { ...fileScope, scanStatus: "PENDING" },
  });
  const failedFileCount = await prisma.prFileObject.count({
    where: { ...fileScope, scanStatus: "FAILED" },
  });
  const cleanFileCount = await prisma.prFileObject.count({
    where: { ...fileScope, scanStatus: "CLEAN" },
  });
  checks.push({
    name: "File lifecycle",
    passed:
      fileCount > 0 &&
      cleanFileCount > 0 &&
      quarantinedCount === 0 &&
      pendingFileCount === 0 &&
      failedFileCount === 0,
    detail: `total=${fileCount}, clean=${cleanFileCount}, pending=${pendingFileCount}, quarantined=${quarantinedCount}, failed=${failedFileCount}`,
  });
  const scannerReady = await isClamAvAvailable();
  checks.push({
    name: "Malware scanner integration",
    passed: scannerReady,
    detail: scannerReady
      ? "ClamAV accepted an INSTREAM readiness scan"
      : "ClamAV is not configured, unreachable, or did not return a clean readiness result.",
  });

  // 5. Publishing evidence: schedules and published tasks
  const scheduleCount = await prisma.prSchedule.count({
    where: { task: { request: org } },
  });
  const publishedTaskCount = await prisma.prTask.count({
    where: { request: org, status: "PUBLISHED" },
  });
  const publishedEvidenceCount = await prisma.prSchedule.count({
    where: { task: { request: org }, publishedAt: { not: null } },
  });
  checks.push({
    name: "Publishing pipeline",
    passed: scheduleCount > 0 && publishedEvidenceCount > 0 && publishedTaskCount > 0,
    detail: `schedules=${scheduleCount}, channelEvidence=${publishedEvidenceCount}, publishedTasks=${publishedTaskCount}`,
  });

  // 6. Notification system
  const notificationCount = await prisma.prNotification.count({
    where: { user: org },
  });
  checks.push({
    name: "Notification system",
    passed: notificationCount > 0,
    detail: `${notificationCount} in-app notification(s)`,
  });
  // 7. Outbox event processing
  const emailOutboxScope = { eventType: "notification.email.queued" };
  const pendingOutbox = await prisma.prOutboxEvent.count({
    where: { ...emailOutboxScope, status: "PENDING" },
  });
  const processingOutbox = await prisma.prOutboxEvent.count({
    where: { ...emailOutboxScope, status: "PROCESSING" },
  });
  const failedOutbox = await prisma.prOutboxEvent.count({
    where: { ...emailOutboxScope, status: "FAILED" },
  });
  const deliveredOutbox = await prisma.prOutboxEvent.count({
    where: { ...emailOutboxScope, status: "DELIVERED" },
  });
  checks.push({
    name: "Outbox events",
    passed: pendingOutbox === 0 && processingOutbox === 0 && failedOutbox === 0,
    detail: `pending=${pendingOutbox}, processing=${processingOutbox}, failed=${failedOutbox}, delivered=${deliveredOutbox}`,
  });
  let outboxWorkerReady = false;
  const outboxWorkerUrl = process.env.PR_CENTER_OUTBOX_WORKER_URL;
  if (outboxWorkerUrl) {
    try {
      const response = await fetch(outboxWorkerUrl, {
        signal: AbortSignal.timeout(5_000),
      });
      const workerState = (await response.json().catch(() => null)) as {
        ready?: unknown;
      } | null;
      outboxWorkerReady = response.ok && workerState?.ready === true;
    } catch {
      outboxWorkerReady = false;
    }
  }
  checks.push({
    name: "Outbox worker",
    passed: outboxWorkerReady,
    detail: outboxWorkerReady
      ? "Email outbox worker reports SMTP ready"
      : "Email outbox worker or SMTP provider is not ready.",
  });
  checks.push({
    name: "External notification delivery",
    passed:
      outboxWorkerReady &&
      deliveredOutbox > 0 &&
      pendingOutbox === 0 &&
      failedOutbox === 0,
    detail:
      outboxWorkerReady && deliveredOutbox > 0
        ? `SMTP ready; delivered=${deliveredOutbox}, pending=${pendingOutbox}, failed=${failedOutbox}`
        : "A verified SMTP worker and at least one completed email delivery are required.",
  });
  let approvalPolicyDetail = "Approval policy is not configured";
  let approvalPolicyConfigured = false;
  try {
    const policy = loadApprovalPolicy();
    approvalPolicyConfigured = true;
    approvalPolicyDetail = `version=${policy.version}, owner reference=${policy.approvalReference}`;
  } catch (error) {
    if (error instanceof Error) approvalPolicyDetail = error.message;
  }
  checks.push({
    name: "Approval authority policy",
    passed: approvalPolicyConfigured,
    detail: approvalPolicyDetail,
  });
  addEvidenceCheck("Authenticated role/scope UAT", "AUTHENTICATED_UAT");
  addEvidenceCheck("Backup and restore UAT", "BACKUP_RESTORE");
  addEvidenceCheck("Role/scope and security UAT", "SECURITY_UAT");
  addEvidenceCheck("Authorized go-live sign-off", "GO_LIVE_SIGNOFF");

  const allPassed = checks.every((c) => c.passed);
  return {
    ready: allPassed,
    checkedAt: new Date().toISOString(),
    checks,
  };
}
