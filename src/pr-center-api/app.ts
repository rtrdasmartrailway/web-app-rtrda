import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import {
  createRequest,
  createIdea,
  convertIdea,
  currentMessageHouse,
  listIdeas,
  listRequests,
  transitionIdea,
  PrCenterError,
  transitionTask,
  type PrCenterActor,
} from "@/lib/pr-center/service";
import { TASK_TRANSITIONS, type PrTaskStatus } from "@/lib/pr-center/workflow";

export type ActorResolver = (request: FastifyRequest) => Promise<PrCenterActor | null>;
export type EmailOnlyAuth = {
  signIn: (
    request: FastifyRequest,
    email: string,
  ) => Promise<{ actor: PrCenterActor; cookie: string }>;
  signOut: (request: FastifyRequest) => string;
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
  emailOnlyAuth?: EmailOnlyAuth,
): FastifyInstance {
  const app = Fastify({ logger: true, requestIdHeader: "x-correlation-id" });
  app.setErrorHandler((error, request, reply) => {
    const known = error instanceof PrCenterError;
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
      request.routeOptions.url === "/session/email"
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
  app.get("/session", async (request) => ({
    userId: request.prCenterActor!.id,
    organizationId: request.prCenterActor!.organizationId,
    departmentId: request.prCenterActor!.departmentId,
    role: request.prCenterActor!.role,
  }));
  app.post("/session/email", async (request, reply) => {
    if (!emailOnlyAuth)
      throw new PrCenterError("Email-only access is disabled", 503, "AUTH_UNAVAILABLE");
    const input = await body(request);
    const login = await emailOnlyAuth.signIn(
      request,
      typeof input.email === "string" ? input.email : "",
    );
    return reply.header("Set-Cookie", login.cookie).send({ role: login.actor.role });
  });
  app.delete("/session", async (request, reply) => {
    if (!emailOnlyAuth) return reply.status(204).send();
    return reply.header("Set-Cookie", emailOnlyAuth.signOut(request)).status(204).send();
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
      },
      correlationId(request),
    );
    return reply.status(201).send(result);
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
  return app;
}

declare module "fastify" {
  interface FastifyRequest {
    prCenterActor?: PrCenterActor;
  }
}
