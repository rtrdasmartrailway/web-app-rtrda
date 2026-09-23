import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import {
  createRequest,
  createIdea,
  addTaskComment,
  convertIdea,
  currentMessageHouse,
  createTaskRevision,
  listIdeas,
  listNotifications,
  listAuditEvents,
  markNotificationsRead,
  listRequests,
  listApprovalQueue,
  recordApprovalDecision,
  requestDetail,
  recordPublishingEvidence,
  scheduleTask,
  transitionRequest,
  updateRequestDraft,
  sessionProfile,
  transitionIdea,
  taskHistory,
  updateTaskAssignment,
  PrCenterError,
  transitionTask,
  type PrCenterActor,
} from "@/lib/pr-center/service";
import { TASK_TRANSITIONS, type PrTaskStatus } from "@/lib/pr-center/workflow";

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
  app.get("/requests/:requestId", async (request) =>
    requestDetail(
      request.prCenterActor!,
      taskId((request.params as { requestId: string }).requestId),
    ),
  );
  app.get("/ideas", async (request) => listIdeas(request.prCenterActor!));
  app.post("/ideas", async (request, reply) => {
    const input = await body(request);
    const idea = await createIdea(
      request.prCenterActor!,
      {
        title: typeof input.title === "string" ? input.title : "",
        rationale: typeof input.rationale === "string" ? input.rationale : "",
      },
      correlationId(request),
    );
    return reply.status(201).send(idea);
  });
  app.post("/ideas/:ideaId/transitions", async (request) => {
    const input = await body(request);
    if (
      typeof input.to !== "string" ||
      !["UNDER_REVIEW", "ACCEPTED", "ARCHIVED"].includes(input.to)
    )
      throw new PrCenterError("Unknown idea status", 422, "INVALID_STATUS");
    return transitionIdea(
      request.prCenterActor!,
      taskId((request.params as { ideaId: string }).ideaId),
      expectedVersion(request),
      input.to as "UNDER_REVIEW" | "ACCEPTED" | "ARCHIVED",
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
  return app;
}

declare module "fastify" {
  interface FastifyRequest {
    prCenterActor?: PrCenterActor;
  }
}
