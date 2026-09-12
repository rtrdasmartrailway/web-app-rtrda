import { randomBytes } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { prisma } from "@/lib/db/client";
import { PrCenterError, type PrCenterActor } from "@/lib/pr-center/service";

const SESSION_COOKIE = "rtrda_pr_center_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

type Session = { actor: PrCenterActor; expiresAt: number };
type LoginResult = { actor: PrCenterActor; cookie: string };

function cookies(request: FastifyRequest): Record<string, string> {
  return Object.fromEntries(
    (request.headers.cookie || "")
      .split(";")
      .map((item) => item.trim().split("=", 2))
      .filter(([key, value]) => Boolean(key && value)),
  );
}

function cookie(value: string, maxAge = SESSION_TTL_SECONDS): string {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function createEmailOnlyAuth() {
  const allowedEmails = new Set(
    (process.env.PR_CENTER_EMAIL_ONLY_ALLOWLIST || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  const enabled = process.env.PR_CENTER_EMAIL_ONLY_ENABLED === "true";
  const expectedOrigin = process.env.SITE_ORIGIN;
  const sessions = new Map<string, Session>();

  function assertSameOrigin(request: FastifyRequest) {
    const origin = request.headers.origin;
    if (origin && expectedOrigin && origin !== expectedOrigin)
      throw new PrCenterError("Cross-origin requests are not allowed", 403, "FORBIDDEN");
  }

  async function auditDenied(email: string) {
    const organization = await prisma.prOrganization.upsert({
      where: { code: "RTRDA" },
      update: {},
      create: { code: "RTRDA", name: "Rail Technology Research and Development Agency" },
    });
    await prisma.prAuditEvent.create({
      data: {
        organizationId: organization.id,
        action: "auth.email_only_denied",
        entityType: "session",
        entityId: email || "empty",
        correlationId: randomBytes(16).toString("hex"),
        after: { email },
      },
    });
  }

  async function administrator(email: string): Promise<PrCenterActor> {
    return prisma.$transaction(async (tx) => {
      const organization = await tx.prOrganization.upsert({
        where: { code: "RTRDA" },
        update: {},
        create: {
          code: "RTRDA",
          name: "Rail Technology Research and Development Agency",
        },
      });
      const department = await tx.prDepartment.upsert({
        where: {
          organizationId_code: { organizationId: organization.id, code: "ADMIN" },
        },
        update: { active: true },
        create: {
          organizationId: organization.id,
          code: "ADMIN",
          name: "Administration",
        },
      });
      const user = await tx.prCenterUser.upsert({
        where: { email },
        update: {
          active: true,
          organizationId: organization.id,
          departmentId: department.id,
          displayName: "Nattapol Y.",
        },
        create: {
          organizationId: organization.id,
          departmentId: department.id,
          ssoSubject: `email-only:${email}`,
          email,
          displayName: "Nattapol Y.",
          active: true,
        },
      });
      const existingRole = await tx.prUserRole.findFirst({
        where: {
          userId: user.id,
          role: "SCOPED_ADMINISTRATOR",
          organizationId: organization.id,
        },
      });
      if (!existingRole) {
        await tx.prUserRole.create({
          data: {
            userId: user.id,
            role: "SCOPED_ADMINISTRATOR",
            organizationId: organization.id,
          },
        });
      }
      const actor = {
        id: user.id,
        organizationId: organization.id,
        departmentId: department.id,
        role: "SCOPED_ADMINISTRATOR" as const,
      };
      const correlationId = randomBytes(16).toString("hex");
      await Promise.all([
        tx.prAuditEvent.create({
          data: {
            organizationId: organization.id,
            actorId: user.id,
            action: "auth.email_only_login",
            entityType: "session",
            entityId: user.id,
            correlationId,
            after: { mode: "temporary_email_only" },
          },
        }),
        tx.prOutboxEvent.create({
          data: {
            aggregateType: "session",
            aggregateId: user.id,
            eventType: "pr.auth.email_only_login",
            payload: { mode: "temporary_email_only" },
            idempotencyKey: `pr.auth.email_only_login:${user.id}:${correlationId}`,
          },
        }),
      ]);
      return actor;
    });
  }

  return {
    async resolve(request: FastifyRequest): Promise<PrCenterActor | null> {
      const token = cookies(request)[SESSION_COOKIE];
      const session = token ? sessions.get(token) : undefined;
      if (!session || session.expiresAt <= Date.now()) {
        if (token) sessions.delete(token);
        return null;
      }
      return session.actor;
    },
    async signIn(request: FastifyRequest, rawEmail: string): Promise<LoginResult> {
      assertSameOrigin(request);
      if (!enabled)
        throw new PrCenterError("Email-only access is disabled", 503, "AUTH_UNAVAILABLE");
      const email = rawEmail.trim().toLowerCase();
      if (!allowedEmails.has(email)) {
        await auditDenied(email);
        throw new PrCenterError(
          "This email is not authorized for PR Center",
          403,
          "FORBIDDEN",
        );
      }
      const actor = await administrator(email);
      const token = randomBytes(32).toString("base64url");
      sessions.set(token, { actor, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 });
      return { actor, cookie: cookie(token) };
    },
    signOut(request: FastifyRequest): string {
      assertSameOrigin(request);
      const token = cookies(request)[SESSION_COOKIE];
      if (token) sessions.delete(token);
      return cookie("", 0);
    },
  };
}
