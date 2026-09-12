import { randomUUID } from "node:crypto";
import type {
  Prisma,
  PrContentIdeaStatus,
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

type CreateRequestInput = {
  type: "PR" | "OFFSITE";
  title: string;
  objective?: string;
  audience?: string;
  requestedFor?: Date;
  sourceUrls: string[];
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
