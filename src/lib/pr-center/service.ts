import { randomUUID } from "node:crypto";
import type { Prisma, PrTaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import {
  canApprove,
  canCreateRequest,
  canReadAllRequests,
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
      },
      include: { revisions: true, sources: true },
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
    include: { requester: { select: { displayName: true } }, tasks: true },
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
