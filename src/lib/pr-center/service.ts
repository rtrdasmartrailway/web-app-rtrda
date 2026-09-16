import { randomUUID } from "node:crypto";
import type {
  Prisma,
  PrContentIdeaStatus,
  PrApprovalDecision,
  PrRequestStatus,
  PrTaskStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import {
  canApprove,
  canCreateRequest,
  canCreateIdea,
  canManageTasks,
  canReadAllRequests,
  canReviewIdeas,
  canTransitionTask,
  publicationGate,
  type PrCenterRole,
  type PrTaskStatus as WorkflowStatus,
} from "./workflow";

export type PrCenterActor = {
  id: string;
  organizationId: string;
  departmentId: string | null;
  role: PrCenterRole;
};

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
    departmentName: user.department?.name || "",
    role: actor.role,
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
};
type IdeaStatus = "PROPOSED" | "UNDER_REVIEW" | "ACCEPTED" | "CONVERTED" | "ARCHIVED";

const IDEA_TRANSITIONS: Record<IdeaStatus, IdeaStatus[]> = {
  PROPOSED: ["UNDER_REVIEW", "ARCHIVED"],
  UNDER_REVIEW: ["ACCEPTED", "ARCHIVED"],
  ACCEPTED: ["ARCHIVED"],
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
  if (!canCreateRequest(actor.role))
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

  return prisma.$transaction(async (tx) => {
    const request = await tx.prRequest.create({
      data: {
        organizationId: actor.organizationId,
        departmentId,
        requesterId: actor.id,
        requestNumber: requestNumber(input.type),
        type: input.type,
        title,
        priority: input.priority || "NORMAL",
        priorityReason: input.priorityReason?.trim() || null,
        requestedFor: input.requestedFor,
        revisions: {
          create: {
            revisionNumber: 1,
            title,
            objective: input.objective?.trim() || null,
            audience: input.audience?.trim() || null,
          },
        },
        sources: { create: sourceUrls.map((url) => ({ url })) },
        tasks: {
          create: {
            title,
            contentType: input.type === "PR" ? "PR Content" : "Off-site Support",
            ownerId: actor.id,
            dueAt: input.requestedFor,
          },
        },
      },
      include: { revisions: true, sources: true, tasks: true },
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
  const where: Prisma.PrRequestWhereInput = canReadAllRequests(actor.role)
    ? {
        organizationId: actor.organizationId,
        ...(actor.role === "SCOPED_ADMINISTRATOR" || !actor.departmentId
          ? {}
          : { departmentId: actor.departmentId }),
      }
    : { organizationId: actor.organizationId, requesterId: actor.id };
  return prisma.prRequest.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      department: { select: { name: true } },
      requester: { select: { displayName: true } },
      sources: { select: { url: true } },
      tasks: true,
    },
  });
}

async function requestInScope(actor: PrCenterActor, requestId: string) {
  const request = await prisma.prRequest.findFirst({
    where: {
      id: requestId,
      organizationId: actor.organizationId,
      ...(canReadAllRequests(actor.role) ? {} : { requesterId: actor.id }),
    },
    include: {
      revisions: { orderBy: { revisionNumber: "desc" } },
      sources: true,
      tasks: true,
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
  if (request.requesterId !== actor.id && actor.role !== "SCOPED_ADMINISTRATOR")
    throw new PrCenterError("You cannot amend this request", 403, "FORBIDDEN");
  if (request.status !== "DRAFT" && request.status !== "SUBMITTED")
    throw new PrCenterError(
      "This request can no longer be amended",
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
  return prisma.$transaction(async (tx) => {
    const revisionNumber = (request.revisions[0]?.revisionNumber || 0) + 1;
    const updated = await tx.prRequest.updateMany({
      where: { id: request.id, version: fromVersion },
      data: {
        title,
        priority: input.priority || request.priority,
        priorityReason: input.priorityReason?.trim() || null,
        requestedFor: input.requestedFor,
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
        changeSummary: "Requester amendment",
      },
    });
    await tx.prRequestSource.deleteMany({ where: { requestId: request.id } });
    if (sourceUrls.length)
      await tx.prRequestSource.createMany({
        data: sourceUrls.map((url) => ({ requestId: request.id, url })),
      });
    await auditAndOutbox(tx, {
      actor,
      action: "request.amended",
      entityType: "request",
      entityId: request.id,
      after: { revisionNumber, version: fromVersion + 1 },
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
  if (request.requesterId !== actor.id && actor.role !== "SCOPED_ADMINISTRATOR")
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

export async function listIdeas(actor: PrCenterActor) {
  return prisma.prContentIdea.findMany({
    where: canReadAllRequests(actor.role)
      ? {
          organizationId: actor.organizationId,
          ...(actor.role === "SCOPED_ADMINISTRATOR" || !actor.departmentId
            ? {}
            : { departmentId: actor.departmentId }),
        }
      : { organizationId: actor.organizationId, proposerId: actor.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function createIdea(
  actor: PrCenterActor,
  input: { title: string; rationale: string },
  correlationId: string = randomUUID(),
) {
  if (!canCreateIdea(actor.role) || !actor.departmentId)
    throw new PrCenterError("You cannot create an idea", 403, "FORBIDDEN");
  const title = input.title.trim();
  const rationale = input.rationale.trim();
  if (
    title.length < 3 ||
    title.length > 300 ||
    rationale.length < 3 ||
    rationale.length > 5000
  )
    throw new PrCenterError(
      "Idea title and rationale must be between 3 and 5000 characters",
      422,
      "INVALID_IDEA",
    );
  return prisma.$transaction(async (tx) => {
    const idea = await tx.prContentIdea.create({
      data: {
        organizationId: actor.organizationId,
        departmentId: actor.departmentId!,
        proposerId: actor.id,
        title,
        rationale,
      },
    });
    await auditAndOutbox(tx, {
      actor,
      action: "idea.created",
      entityType: "content_idea",
      entityId: idea.id,
      after: { status: idea.status, version: idea.version },
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
  if (!canReviewIdeas(actor.role))
    throw new PrCenterError("You cannot review an idea", 403, "FORBIDDEN");
  const idea = await prisma.prContentIdea.findFirst({
    where: { id: ideaId, organizationId: actor.organizationId },
  });
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
  return prisma.$transaction(async (tx) => {
    const updated = await tx.prContentIdea.updateMany({
      where: { id: idea.id, version: fromVersion },
      data: {
        status: to as PrContentIdeaStatus,
        reviewerId: actor.id,
        decisionReason: reason?.trim() || null,
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
      action: "idea.transitioned",
      entityType: "content_idea",
      entityId: idea.id,
      after: { from: idea.status, to, version: fromVersion + 1 },
      eventType: "pr.idea.transitioned",
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
  if (!canReviewIdeas(actor.role))
    throw new PrCenterError("You cannot convert an idea", 403, "FORBIDDEN");
  const idea = await prisma.prContentIdea.findFirst({
    where: { id: ideaId, organizationId: actor.organizationId },
  });
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
      where: { id: idea.id, status: "ACCEPTED", version: fromVersion },
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

export async function currentMessageHouse(actor: PrCenterActor) {
  return prisma.prMessageHouseVersion.findFirst({
    where: {
      organizationId: actor.organizationId,
      status: "APPROVED",
      effectiveAt: { lte: new Date() },
    },
    orderBy: [{ effectiveAt: "desc" }, { versionNumber: "desc" }],
  });
}

export async function updateTaskAssignment(
  actor: PrCenterActor,
  taskId: string,
  fromVersion: number,
  input: { ownerId: string | null; dueAt: Date | null },
  correlationId: string = randomUUID(),
) {
  if (!canManageTasks(actor.role))
    throw new PrCenterError("You cannot assign a task", 403, "FORBIDDEN");
  const task = await prisma.prTask.findFirst({
    where: { id: taskId, request: { organizationId: actor.organizationId } },
  });
  if (!task) throw new PrCenterError("Task not found", 404, "NOT_FOUND");
  if (task.version !== fromVersion)
    throw new PrCenterError(
      "This task has changed. Refresh and try again.",
      409,
      "STALE_UPDATE",
    );
  if (input.ownerId) {
    const owner = await prisma.prCenterUser.findFirst({
      where: { id: input.ownerId, organizationId: actor.organizationId, active: true },
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
          title: "PR Center task assigned",
          body: task.title,
          target: "operations",
        },
      });
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
    return tx.prTask.findUniqueOrThrow({ where: { id: task.id } });
  });
}

export async function addTaskComment(
  actor: PrCenterActor,
  taskId: string,
  body: string,
  correlationId: string = randomUUID(),
) {
  const task = await prisma.prTask.findFirst({
    where: { id: taskId, request: { organizationId: actor.organizationId } },
    include: { request: true },
  });
  if (!task || (!canReadAllRequests(actor.role) && task.request.requesterId !== actor.id))
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
    where: { id: taskId, request: { organizationId: actor.organizationId } },
    include: { request: true },
  });
  if (!task || (!canReadAllRequests(actor.role) && task.request.requesterId !== actor.id))
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
    where: canReadAllRequests(actor.role)
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
    where: { id: taskId, request: { organizationId: actor.organizationId } },
  });
  if (!task) throw new PrCenterError("Task not found", 404, "NOT_FOUND");
  if (task.version !== fromVersion)
    throw new PrCenterError(
      "This task has changed. Refresh and try again.",
      409,
      "STALE_UPDATE",
    );
  if (!canTransitionTask(actor.role, task.status as WorkflowStatus, to)) {
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

export function assertApprovalAuthority(actor: PrCenterActor) {
  if (!canApprove(actor.role))
    throw new PrCenterError("You cannot record an approval decision", 403, "FORBIDDEN");
}

export async function createTaskRevision(
  actor: PrCenterActor,
  taskId: string,
  fromVersion: number,
  input: { body?: string; keyMessage?: string; changeSummary?: string },
  correlationId: string = randomUUID(),
) {
  if (!canManageTasks(actor.role))
    throw new PrCenterError("You cannot revise this task", 403, "FORBIDDEN");
  const task = await prisma.prTask.findFirst({
    where: { id: taskId, request: { organizationId: actor.organizationId } },
    include: { revisions: { orderBy: { revisionNumber: "desc" } } },
  });
  if (!task) throw new PrCenterError("Task not found", 404, "NOT_FOUND");
  if (task.version !== fromVersion)
    throw new PrCenterError(
      "This task has changed. Refresh and try again.",
      409,
      "STALE_UPDATE",
    );
  if (["PUBLISHED", "CLOSED", "CANCELLED"].includes(task.status))
    throw new PrCenterError(
      "This task can no longer be revised",
      422,
      "INVALID_TRANSITION",
    );
  const body = input.body?.trim() || null;
  const keyMessage = input.keyMessage?.trim() || null;
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
        reason: input.changeSummary?.trim() || "Material revision",
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
  if (!canApprove(actor.role))
    throw new PrCenterError("You cannot view the approval queue", 403, "FORBIDDEN");
  return prisma.prTask.findMany({
    where: {
      request: { organizationId: actor.organizationId },
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
      request: { select: { title: true, requesterId: true } },
      revisions: { orderBy: { revisionNumber: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "asc" },
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
    where: { id: taskId, request: { organizationId: actor.organizationId } },
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
  if (
    ![
      "SOURCE_FACT_CHECK",
      "TECHNICAL_REVIEW",
      "PR_EDITORIAL_REVIEW",
      "MANAGEMENT_APPROVAL",
    ].includes(task.status)
  )
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
  const next = input.decision === "APPROVED" ? "APPROVED" : input.decision;
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
      },
      eventType: "pr.approval.recorded",
      correlationId,
    });
    return approval;
  });
}

export async function scheduleTask(
  actor: PrCenterActor,
  taskId: string,
  fromVersion: number,
  input: { channel: string; scheduledFor: Date; idempotencyKey: string },
  correlationId: string = randomUUID(),
) {
  if (!canManageTasks(actor.role))
    throw new PrCenterError("You cannot schedule this task", 403, "FORBIDDEN");
  const channel = input.channel.trim();
  const idempotencyKey = input.idempotencyKey.trim();
  if (!channel || channel.length > 100)
    throw new PrCenterError("A publication channel is required", 422, "INVALID_CHANNEL");
  if (Number.isNaN(input.scheduledFor.getTime()))
    throw new PrCenterError("Schedule time is invalid", 422, "INVALID_SCHEDULE");
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128)
    throw new PrCenterError("Idempotency key is invalid", 422, "INVALID_IDEMPOTENCY_KEY");
  const existing = await prisma.prSchedule.findUnique({ where: { idempotencyKey } });
  if (existing) {
    if (existing.taskId !== taskId)
      throw new PrCenterError(
        "Idempotency key is already in use",
        409,
        "IDEMPOTENCY_CONFLICT",
      );
    return existing;
  }
  const task = await prisma.prTask.findFirst({
    where: { id: taskId, request: { organizationId: actor.organizationId } },
    include: {
      request: { include: { sources: true } },
      revisions: { orderBy: { revisionNumber: "desc" }, take: 1 },
    },
  });
  if (!task) throw new PrCenterError("Task not found", 404, "NOT_FOUND");
  if (task.version !== fromVersion)
    throw new PrCenterError(
      "This task has changed. Refresh and try again.",
      409,
      "STALE_UPDATE",
    );
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
    approved: task.status === "APPROVED",
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
      where: { id: task.id, version: fromVersion, status: "APPROVED" },
      data: { status: "SCHEDULED", channel, version: { increment: 1 } },
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
        scheduledFor: input.scheduledFor,
        idempotencyKey,
      },
    });
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
      action: "task.scheduled",
      entityType: "task",
      entityId: task.id,
      after: {
        scheduleId: schedule.id,
        channel,
        scheduledFor: input.scheduledFor.toISOString(),
        version: fromVersion + 1,
      },
      eventType: "pr.task.scheduled",
      correlationId,
    });
    return schedule;
  });
}

export async function recordPublishingEvidence(
  actor: PrCenterActor,
  taskId: string,
  fromVersion: number,
  input: { publishedUrl: string; publishedReference: string },
  correlationId: string = randomUUID(),
) {
  if (!canManageTasks(actor.role))
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
    where: { id: taskId, request: { organizationId: actor.organizationId } },
    include: {
      schedules: {
        where: { publishedAt: null },
        orderBy: { scheduledFor: "desc" },
        take: 1,
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
  if (task.status !== "SCHEDULED" || !schedule)
    throw new PrCenterError(
      "This task has no pending schedule",
      422,
      "INVALID_TRANSITION",
    );
  return prisma.$transaction(async (tx) => {
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
    const publishedAt = new Date();
    await tx.prSchedule.update({
      where: { id: schedule.id },
      data: { publishedUrl, publishedReference, publishedAt },
    });
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
      action: "task.published",
      entityType: "task",
      entityId: task.id,
      after: {
        scheduleId: schedule.id,
        publishedUrl,
        publishedReference,
        publishedAt: publishedAt.toISOString(),
        version: fromVersion + 1,
      },
      eventType: "pr.task.published",
      correlationId,
    });
    return { id: schedule.id, publishedUrl, publishedReference, publishedAt };
  });
}
