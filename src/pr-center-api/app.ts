import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import {
  createRequest,
  createIdea,
  addIdeaComment,
  listIdeaComments,
  addTaskComment,
  convertIdea,
  currentMessageHouse,
  listCalendarEntries,
  messageHouseHistory,
  createTaskRevision,
  listIdeas,
  listNotifications,
  listAuditEvents,
  markNotificationsRead,
  listRequests,
  listApprovalQueue,
  listRequestApprovalQueue,
  listAssignableUsers,
  listTaskSchedules,
  recordApprovalDecision,
  recordRequestDecision,
  requestDetail,
  recordPublishingEvidence,
  scheduleTask,
  transitionRequest,
  updateRequestDraft,
  sessionProfile,
  transitionIdea,
  taskHistory,
  updateTaskAssignment,
  transitionTask,
  uploadFile,
  downloadFile,
  createAttachment,
  listAttachments,
  removeAttachment,
  assignFinalAsset,
  listAdminUsers,
  grantRole,
  revokeRole,
  toggleUserActive,
  listAccessAuditEvents,
  evaluateNotificationReminders,
  listQuarantinedFiles,
  reviewQuarantinedFile,
  rescanFile,
  exportAuditEvents,
  restoreRequest,
  releaseReadinessCheck,
  PrCenterError,
  type PrCenterActor,
} from "@/lib/pr-center/service";
import {
  TASK_TRANSITIONS,
  type PrCenterRole,
  type PrTaskStatus,
} from "@/lib/pr-center/workflow";

export type ActorResolver = (request: FastifyRequest) => Promise<PrCenterActor | null>;
export type EntraAuth = {
  resolve: (request: FastifyRequest) => Promise<PrCenterActor | null>;
  begin: () => Promise<{ url: string; cookie: string }>;
  callback: (request: FastifyRequest) => Promise<{ cookie: string[]; redirect: string }>;
  signOut: (request: FastifyRequest) => string[];
};

function correlationId(request: FastifyRequest): string {
  return request.headers["x-correlation-id"]?.toString().slice(0, 128) || request.id;
}

async function body(request: FastifyRequest): Promise<Record<string, unknown>> {
  if (!request.body || typeof request.body !== "object" || Array.isArray(request.body))
    throw new PrCenterError("A JSON object is required", 400, "INVALID_BODY");
  return request.body as Record<string, unknown>;
}

function expectedVersion(request: FastifyRequest): number {
  const raw = request.headers["if-match"]?.replaceAll('"', "");
  const version = Number(raw);
  if (!Number.isInteger(version) || version < 1)
    throw new PrCenterError(
      "If-Match must contain the current row version",
      428,
      "PRECONDITION_REQUIRED",
    );
  return version;
}

function taskId(value: string): `${string}-${string}-${string}-${string}-${string}` {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new PrCenterError("Task ID is invalid", 422, "INVALID_TASK_ID");
  return value as `${string}-${string}-${string}-${string}-${string}`;
}

export function buildPrCenterApi(
  resolveActor: ActorResolver,
  entraAuth?: EntraAuth | null,
): FastifyInstance {
  const app = Fastify({
    logger: {
      redact: { paths: ["req.url", "req.headers.cookie"], censor: "[REDACTED]" },
    },
    requestIdHeader: "x-correlation-id",
  });
  app.setErrorHandler((error, request, reply) => {
    const known = error instanceof PrCenterError;
    if (!known) request.log.error({ err: error }, "Unhandled PR Center API error");
    reply.status(known ? error.statusCode : 500).send({
      error: known ? error.code : "INTERNAL_ERROR",
      message: known ? error.message : "The request could not be completed",
      correlationId: correlationId(request),
    });
  });
  app.get("/healthz", async () => ({ ok: true, service: "pr-center-api" }));

  app.addHook("preHandler", async (request) => {
    if (
      request.routeOptions.url === "/healthz" ||
      request.routeOptions.url === "/auth/login" ||
      request.routeOptions.url === "/auth/callback"
    )
      return;
    const actor = await resolveActor(request);
    if (!actor)
      throw new PrCenterError("Authentication is required", 401, "UNAUTHENTICATED");
    request.prCenterActor = actor;
  });

  app.get("/requests", async (request) => {
    const query = request.query as { take?: string; cursor?: string };
    return listRequests(request.prCenterActor!, Number(query.take || 25), query.cursor);
  });
  app.get("/approvals", async (request) => listApprovalQueue(request.prCenterActor!));
  app.get("/request-approvals", async (request) =>
    listRequestApprovalQueue(request.prCenterActor!),
  );
  app.get("/users/assignable", async (request) =>
    listAssignableUsers(request.prCenterActor!),
  );
  app.get("/requests/:requestId", async (request) =>
    requestDetail(
      request.prCenterActor!,
      taskId((request.params as { requestId: string }).requestId),
    ),
  );
  app.get("/ideas", async (request) => {
    const query = request.query as {
      take?: string;
      offset?: string;
      search?: string;
      status?: string;
    };
    return listIdeas(request.prCenterActor!, {
      take: query.take === undefined ? 50 : Number(query.take),
      offset: query.offset === undefined ? 0 : Number(query.offset),
      search: query.search,
      status: query.status,
    });
  });
  app.post("/ideas", async (request, reply) => {
    const input = await body(request);
    const idea = await createIdea(request.prCenterActor!, input, correlationId(request));
    return reply.status(201).send(idea);
  });
  app.get("/ideas/:ideaId/comments", async (request) =>
    listIdeaComments(
      request.prCenterActor!,
      taskId((request.params as { ideaId: string }).ideaId),
    ),
  );
  app.post("/ideas/:ideaId/comments", async (request, reply) => {
    const input = await body(request);
    const comment = await addIdeaComment(
      request.prCenterActor!,
      taskId((request.params as { ideaId: string }).ideaId),
      input.body,
      correlationId(request),
    );
    return reply.status(201).send(comment);
  });
  app.post("/ideas/:ideaId/transitions", async (request) => {
    const input = await body(request);
    if (
      typeof input.to !== "string" ||
      !["UNDER_REVIEW", "ACCEPTED", "REJECTED", "ARCHIVED"].includes(input.to)
    )
      throw new PrCenterError("Unknown idea status", 422, "INVALID_STATUS");
    return transitionIdea(
      request.prCenterActor!,
      taskId((request.params as { ideaId: string }).ideaId),
      expectedVersion(request),
      input.to as "UNDER_REVIEW" | "ACCEPTED" | "REJECTED" | "ARCHIVED",
      typeof input.reason === "string" ? input.reason : undefined,
      correlationId(request),
    );
  });
  app.post("/ideas/:ideaId/convert", async (request) =>
    convertIdea(
      request.prCenterActor!,
      taskId((request.params as { ideaId: string }).ideaId),
      expectedVersion(request),
      correlationId(request),
    ),
  );
  app.get("/message-house/current", async (request) =>
    currentMessageHouse(request.prCenterActor!),
  );
  app.get("/message-house/history", async (request) =>
    messageHouseHistory(request.prCenterActor!),
  );
  app.get("/calendar", async (request) => {
    const query = request.query as { from?: string; to?: string };
    return listCalendarEntries(
      request.prCenterActor!,
      new Date(query.from ?? ""),
      new Date(query.to ?? ""),
    );
  });
  app.get("/notifications", async (request) => listNotifications(request.prCenterActor!));
  app.post("/notifications/read", async (request) => {
    const input = await body(request);
    return markNotificationsRead(
      request.prCenterActor!,
      Array.isArray(input.ids)
        ? input.ids.filter((id): id is string => typeof id === "string")
        : [],
      correlationId(request),
    );
  });
  app.post("/notifications/evaluate-reminders", async (request) =>
    evaluateNotificationReminders(request.prCenterActor!),
  );
  app.get("/audit", async (request) => {
    const query = request.query as { take?: string };
    return listAuditEvents(request.prCenterActor!, Number(query.take || 100));
  });
  app.get("/session", async (request) => sessionProfile(request.prCenterActor!));
  app.get("/auth/login", async (request, reply) => {
    if (!entraAuth)
      throw new PrCenterError(
        "Microsoft sign-in is unavailable",
        503,
        "AUTH_UNAVAILABLE",
      );
    const login = await entraAuth.begin();
    return reply.header("Set-Cookie", login.cookie).redirect(login.url);
  });
  app.get("/auth/callback", async (request, reply) => {
    if (!entraAuth)
      throw new PrCenterError(
        "Microsoft sign-in is unavailable",
        503,
        "AUTH_UNAVAILABLE",
      );
    try {
      const login = await entraAuth.callback(request);
      return reply.header("Set-Cookie", login.cookie).redirect(login.redirect);
    } catch (error) {
      request.log.warn(
        {
          error: error instanceof Error ? error.name : "unknown",
          errorCode:
            error instanceof PrCenterError ? error.code : "UNEXPECTED_OIDC_ERROR",
        },
        "OIDC callback failed",
      );
      return reply
        .header("Set-Cookie", entraAuth.signOut(request))
        .redirect("/rtrdaintranet/prcenter?signin=failed");
    }
  });
  app.post("/auth/logout", async (request, reply) => {
    if (!entraAuth)
      throw new PrCenterError(
        "Microsoft sign-in is unavailable",
        503,
        "AUTH_UNAVAILABLE",
      );
    return reply.header("Set-Cookie", entraAuth.signOut(request)).status(204).send();
  });
  app.post("/requests", async (request, reply) => {
    const input = await body(request);
    const result = await createRequest(
      request.prCenterActor!,
      {
        type: input.type === "OFFSITE" ? "OFFSITE" : "PR",
        title: typeof input.title === "string" ? input.title : "",
        objective: typeof input.objective === "string" ? input.objective : undefined,
        audience: typeof input.audience === "string" ? input.audience : undefined,
        requestedFor:
          typeof input.requestedFor === "string"
            ? new Date(input.requestedFor)
            : undefined,
        sourceUrls: Array.isArray(input.sourceUrls)
          ? input.sourceUrls.filter((item): item is string => typeof item === "string")
          : [],
        priority: typeof input.priority === "string" ? input.priority : undefined,
        priorityReason:
          typeof input.priorityReason === "string" ? input.priorityReason : undefined,
      },
      correlationId(request),
    );
    return reply.status(201).send(result);
  });
  app.patch("/requests/:requestId", async (request) => {
    const input = await body(request);
    return updateRequestDraft(
      request.prCenterActor!,
      taskId((request.params as { requestId: string }).requestId),
      expectedVersion(request),
      {
        type: input.type === "OFFSITE" ? "OFFSITE" : "PR",
        title: typeof input.title === "string" ? input.title : "",
        objective: typeof input.objective === "string" ? input.objective : undefined,
        audience: typeof input.audience === "string" ? input.audience : undefined,
        requestedFor:
          typeof input.requestedFor === "string"
            ? new Date(input.requestedFor)
            : undefined,
        sourceUrls: Array.isArray(input.sourceUrls)
          ? input.sourceUrls.filter((item): item is string => typeof item === "string")
          : [],
        priority: typeof input.priority === "string" ? input.priority : undefined,
        priorityReason:
          typeof input.priorityReason === "string" ? input.priorityReason : undefined,
      },
      correlationId(request),
    );
  });
  app.post("/requests/:requestId/transitions", async (request) => {
    const input = await body(request);
    if (input.to !== "SUBMITTED" && input.to !== "WITHDRAWN")
      throw new PrCenterError("Unknown request status", 422, "INVALID_STATUS");
    return transitionRequest(
      request.prCenterActor!,
      taskId((request.params as { requestId: string }).requestId),
      expectedVersion(request),
      input.to,
      correlationId(request),
    );
  });
  app.post("/requests/:requestId/decisions", async (request) => {
    const input = await body(request);
    if (input.decision !== "APPROVED" && input.decision !== "REJECTED")
      throw new PrCenterError("Unknown request decision", 422, "INVALID_DECISION");
    return recordRequestDecision(
      request.prCenterActor!,
      taskId((request.params as { requestId: string }).requestId),
      expectedVersion(request),
      {
        decision: input.decision,
        reason: typeof input.reason === "string" ? input.reason : undefined,
      },
      correlationId(request),
    );
  });
  app.get("/tasks/:taskId/schedules", async (request) =>
    listTaskSchedules(
      request.prCenterActor!,
      taskId((request.params as { taskId: string }).taskId),
    ),
  );
  app.post("/tasks/:taskId/transitions", async (request) => {
    const input = await body(request);
    const to = input.to;
    if (typeof to !== "string" || !(to in TASK_TRANSITIONS))
      throw new PrCenterError("Unknown task status", 422, "INVALID_STATUS");
    return transitionTask(
      request.prCenterActor!,
      taskId((request.params as { taskId: string }).taskId),
      expectedVersion(request),
      to as PrTaskStatus,
      typeof input.reason === "string" ? input.reason : undefined,
      correlationId(request),
    );
  });
  app.post("/tasks/:taskId/revisions", async (request) => {
    const input = await body(request);
    return createTaskRevision(
      request.prCenterActor!,
      taskId((request.params as { taskId: string }).taskId),
      expectedVersion(request),
      {
        body: typeof input.body === "string" ? input.body : undefined,
        keyMessage: typeof input.keyMessage === "string" ? input.keyMessage : undefined,
        changeSummary:
          typeof input.changeSummary === "string" ? input.changeSummary : undefined,
      },
      correlationId(request),
    );
  });
  app.post("/tasks/:taskId/approvals", async (request) => {
    const input = await body(request);
    if (!["APPROVED", "REVISION_REQUIRED", "REJECTED"].includes(String(input.decision)))
      throw new PrCenterError("Unknown approval decision", 422, "INVALID_DECISION");
    return recordApprovalDecision(
      request.prCenterActor!,
      taskId((request.params as { taskId: string }).taskId),
      expectedVersion(request),
      {
        decision: input.decision as "APPROVED" | "REVISION_REQUIRED" | "REJECTED",
        comment: typeof input.comment === "string" ? input.comment : undefined,
      },
      correlationId(request),
    );
  });
  app.post("/tasks/:taskId/schedule", async (request) => {
    const input = await body(request);
    return scheduleTask(
      request.prCenterActor!,
      taskId((request.params as { taskId: string }).taskId),
      expectedVersion(request),
      {
        channel: typeof input.channel === "string" ? input.channel : "",
        scheduledFor:
          typeof input.scheduledFor === "string"
            ? new Date(input.scheduledFor)
            : new Date("invalid"),
        idempotencyKey:
          typeof input.idempotencyKey === "string" ? input.idempotencyKey : "",
      },
      correlationId(request),
    );
  });
  app.post("/tasks/:taskId/publishing-evidence", async (request) => {
    const input = await body(request);
    return recordPublishingEvidence(
      request.prCenterActor!,
      taskId((request.params as { taskId: string }).taskId),
      expectedVersion(request),
      {
        publishedUrl: typeof input.publishedUrl === "string" ? input.publishedUrl : "",
        publishedReference:
          typeof input.publishedReference === "string" ? input.publishedReference : "",
        channel: typeof input.channel === "string" ? input.channel : undefined,
      },
      correlationId(request),
    );
  });
  app.patch("/tasks/:taskId", async (request) => {
    const input = await body(request);
    const dueAt =
      typeof input.dueAt === "string" && input.dueAt ? new Date(input.dueAt) : null;
    if (dueAt && Number.isNaN(dueAt.getTime()))
      throw new PrCenterError("Due date is invalid", 422, "INVALID_DUE_DATE");
    return updateTaskAssignment(
      request.prCenterActor!,
      taskId((request.params as { taskId: string }).taskId),
      expectedVersion(request),
      { ownerId: typeof input.ownerId === "string" ? input.ownerId : null, dueAt },
      correlationId(request),
    );
  });
  app.get("/tasks/:taskId/history", async (request) =>
    taskHistory(
      request.prCenterActor!,
      taskId((request.params as { taskId: string }).taskId),
    ),
  );
  app.post("/tasks/:taskId/comments", async (request, reply) => {
    const input = await body(request);
    const comment = await addTaskComment(
      request.prCenterActor!,
      taskId((request.params as { taskId: string }).taskId),
      typeof input.body === "string" ? input.body : "",
      correlationId(request),
    );
    return reply.status(201).send(comment);
  });
  // ── File upload/download and attachment routes ──────────────────────────
  app.post("/files", async (request, reply) => {
    const input = await body(request);
    if (typeof input.fileName !== "string" || typeof input.mimeType !== "string")
      throw new PrCenterError("fileName and mimeType are required", 422, "INVALID_BODY");
    if (typeof input.content !== "string")
      throw new PrCenterError(
        "content must be a base64-encoded string",
        422,
        "INVALID_BODY",
      );
    let contentBuffer: Buffer;
    try {
      contentBuffer = Buffer.from(input.content, "base64");
    } catch {
      throw new PrCenterError("content is not valid base64", 422, "INVALID_BASE64");
    }
    if (contentBuffer.length === 0)
      throw new PrCenterError("File content is empty", 422, "EMPTY_FILE");
    const fileObject = await uploadFile(
      request.prCenterActor!,
      { fileName: input.fileName, mimeType: input.mimeType, content: contentBuffer },
      correlationId(request),
    );
    return reply.status(201).send(fileObject);
  });
  app.get("/files/:fileId/download", async (request, reply) => {
    const { buffer, fileName, mimeType } = await downloadFile(
      request.prCenterActor!,
      (request.params as { fileId: string }).fileId,
    );
    return reply
      .header("Content-Type", mimeType)
      .header("Content-Disposition", `attachment; filename="${fileName}"`)
      .header("Content-Length", String(buffer.length))
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff")
      .send(buffer);
  });
  app.post("/attachments", async (request, reply) => {
    const input = await body(request);
    const attachment = await createAttachment(
      request.prCenterActor!,
      {
        fileId: typeof input.fileId === "string" ? input.fileId : "",
        requestId: typeof input.requestId === "string" ? input.requestId : undefined,
        taskId: typeof input.taskId === "string" ? input.taskId : undefined,
        kind: typeof input.kind === "string" ? input.kind : "",
      },
      correlationId(request),
    );
    return reply.status(201).send(attachment);
  });
  app.get("/attachments", async (request) => {
    const query = request.query as { requestId?: string; taskId?: string };
    return listAttachments(request.prCenterActor!, {
      requestId: query.requestId,
      taskId: query.taskId,
    });
  });
  app.delete("/attachments/:attachmentId", async (request) => {
    return removeAttachment(
      request.prCenterActor!,
      (request.params as { attachmentId: string }).attachmentId,
      correlationId(request),
    );
  });
  app.post("/tasks/:taskId/final-asset", async (request) => {
    const input = await body(request);
    return assignFinalAsset(
      request.prCenterActor!,
      taskId((request.params as { taskId: string }).taskId),
      expectedVersion(request),
      {
        fileId: typeof input.fileId === "string" ? input.fileId : "",
        revisionNumber:
          typeof input.revisionNumber === "number" ? input.revisionNumber : undefined,
      },
      correlationId(request),
    );
  });
  // ── Access Administration routes (SCOPED_ADMINISTRATOR only) ────────────
  app.get("/admin/users", async (request) => listAdminUsers(request.prCenterActor!));
  app.post("/admin/users/:userId/roles", async (request, reply) => {
    const input =
      request.body && typeof request.body === "object" && !Array.isArray(request.body)
        ? (request.body as Record<string, unknown>)
        : {};
    const result = await grantRole(
      request.prCenterActor!,
      (request.params as { userId: string }).userId,
      input.role as PrCenterRole,
      typeof input.departmentId === "string" ? input.departmentId : null,
      input.reason,
      correlationId(request),
    );
    return reply.status(201).send(result);
  });
  app.delete("/admin/roles/:roleId", async (request) => {
    const input =
      request.body && typeof request.body === "object" && !Array.isArray(request.body)
        ? (request.body as Record<string, unknown>)
        : {};
    return revokeRole(
      request.prCenterActor!,
      (request.params as { roleId: string }).roleId,
      input.reason,
      correlationId(request),
    );
  });
  app.patch("/admin/users/:userId/active", async (request) => {
    const input =
      request.body && typeof request.body === "object" && !Array.isArray(request.body)
        ? (request.body as Record<string, unknown>)
        : {};
    return toggleUserActive(
      request.prCenterActor!,
      (request.params as { userId: string }).userId,
      input.reason,
      correlationId(request),
    );
  });
  app.get("/admin/access-audit", async (request) => {
    const query = request.query as { take?: string };
    return listAccessAuditEvents(request.prCenterActor!, Number(query.take || 100));
  });
  // ── Quarantine management routes ─────────────────────────────────────
  app.get("/admin/quarantine", async (request) => {
    const query = request.query as { take?: string };
    return listQuarantinedFiles(request.prCenterActor!, Number(query.take || 50));
  });
  app.post("/admin/quarantine/:fileId/review", async (request) => {
    const input = await body(request);
    if (input.disposition !== "approve" && input.disposition !== "delete")
      throw new PrCenterError(
        "Disposition must be 'approve' or 'delete'",
        422,
        "INVALID_DISPOSITION",
      );
    return reviewQuarantinedFile(
      request.prCenterActor!,
      (request.params as { fileId: string }).fileId,
      input.disposition,
      typeof input.reason === "string" ? input.reason : undefined,
      correlationId(request),
    );
  });
  app.post("/admin/quarantine/:fileId/rescan", async (request) =>
    rescanFile(
      request.prCenterActor!,
      (request.params as { fileId: string }).fileId,
      correlationId(request),
    ),
  );
  // ── Audit export (SCOPED_ADMINISTRATOR) ──────────────────────────────
  app.post("/audit/export", async (request) => {
    const input = await body(request);
    return exportAuditEvents(request.prCenterActor!, {
      from: typeof input.from === "string" ? input.from : undefined,
      to: typeof input.to === "string" ? input.to : undefined,
      entityType: typeof input.entityType === "string" ? input.entityType : undefined,
      actorId: typeof input.actorId === "string" ? input.actorId : undefined,
    });
  });
  // ── Restore / compensating-change (SCOPED_ADMINISTRATOR) ─────────────
  app.post("/requests/:requestId/restore", async (request) => {
    const input = await body(request);
    return restoreRequest(
      request.prCenterActor!,
      taskId((request.params as { requestId: string }).requestId),
      expectedVersion(request),
      typeof input.reason === "string" ? input.reason : undefined,
      correlationId(request),
    );
  });
  // ── Release readiness (SCOPED_ADMINISTRATOR) ─────────────────────────
  app.get("/admin/release-readiness", async (request) =>
    releaseReadinessCheck(request.prCenterActor!),
  );
  return app;
}

declare module "fastify" {
  interface FastifyRequest {
    prCenterActor?: PrCenterActor;
  }
}
