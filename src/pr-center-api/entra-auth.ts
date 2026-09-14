import { randomBytes } from "node:crypto";
import * as oidc from "openid-client";
import type { FastifyRequest } from "fastify";
import { prisma } from "@/lib/db/client";
import { PrCenterError, type PrCenterActor } from "@/lib/pr-center/service";
import { PR_CENTER_ROLES, type PrCenterRole } from "@/lib/pr-center/workflow";

const SESSION_COOKIE = "rtrda_pr_center_oidc_session";
const STATE_COOKIE = "rtrda_pr_center_oidc_state";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const STATE_TTL_MS = 10 * 60 * 1000;

type Session = { actor: PrCenterActor; expiresAt: number };
type PendingLogin = { verifier: string; nonce: string; expiresAt: number };

function cookies(request: FastifyRequest) {
  return Object.fromEntries(
    (request.headers.cookie || "")
      .split(";")
      .map((item) => item.trim().split("=", 2))
      .filter(([key, value]) => Boolean(key && value)),
  );
}

function cookie(name: string, value: string, maxAge: number, sameSite: "Lax" | "Strict") {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=${sameSite}; Max-Age=${maxAge}`;
}

function config() {
  const tenantId = process.env.ENTRA_TENANT_ID;
  const clientId = process.env.ENTRA_CLIENT_ID;
  const clientSecret = process.env.ENTRA_CLIENT_SECRET;
  const issuer = process.env.ENTRA_ISSUER;
  const redirectUri = process.env.ENTRA_REDIRECT_URI;
  const postLogoutRedirectUri = process.env.ENTRA_POST_LOGOUT_REDIRECT_URI;
  if (
    !tenantId ||
    !clientId ||
    !clientSecret ||
    !issuer ||
    !redirectUri ||
    !postLogoutRedirectUri
  )
    return null;
  return { tenantId, clientId, clientSecret, issuer, redirectUri, postLogoutRedirectUri };
}

export function createEntraAuth() {
  const settings = config();
  if (!settings) return null;
  const oidcSettings = settings;
  const pending = new Map<string, PendingLogin>();
  const sessions = new Map<string, Session>();
  const discovery = oidc.discovery(
    new URL(settings.issuer),
    oidcSettings.clientId,
    oidcSettings.clientSecret,
  );

  async function provision(claims: Record<string, unknown>): Promise<PrCenterActor> {
    const oid = typeof claims.oid === "string" ? claims.oid : "";
    const tid = typeof claims.tid === "string" ? claims.tid : "";
    const roles = Array.isArray(claims.roles) ? claims.roles : [];
    const role = roles.find(
      (value): value is PrCenterRole =>
        typeof value === "string" && PR_CENTER_ROLES.includes(value as PrCenterRole),
    );
    if (!oid || tid !== oidcSettings.tenantId || !role)
      throw new PrCenterError(
        "Your account is not assigned a PR Center role",
        403,
        "ACCESS_DENIED",
      );
    const email =
      typeof claims.preferred_username === "string" ? claims.preferred_username : "";
    const displayName =
      typeof claims.name === "string" ? claims.name : email || "RTRDA user";
    if (!email)
      throw new PrCenterError(
        "Your Entra account has no organization email",
        403,
        "ACCESS_DENIED",
      );
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
          organizationId_code: { organizationId: organization.id, code: "UNASSIGNED" },
        },
        update: { active: true },
        create: {
          organizationId: organization.id,
          code: "UNASSIGNED",
          name: "Unassigned",
        },
      });
      const user = await tx.prCenterUser.upsert({
        where: { email },
        update: {
          ssoSubject: `entra:${oid}`,
          displayName,
          active: true,
          organizationId: organization.id,
        },
        create: {
          organizationId: organization.id,
          departmentId: department.id,
          ssoSubject: `entra:${oid}`,
          email,
          displayName,
          active: true,
        },
      });
      const existingRole = await tx.prUserRole.findFirst({
        where: {
          userId: user.id,
          role,
          organizationId: organization.id,
          departmentId: null,
        },
      });
      if (!existingRole)
        await tx.prUserRole.create({
          data: { userId: user.id, role, organizationId: organization.id },
        });
      await tx.prAuditEvent.create({
        data: {
          organizationId: organization.id,
          actorId: user.id,
          action: "auth.oidc_login",
          entityType: "session",
          entityId: user.id,
          correlationId: randomBytes(16).toString("hex"),
          after: { role },
        },
      });
      return {
        id: user.id,
        organizationId: organization.id,
        departmentId: user.departmentId,
        role,
      };
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
    async begin() {
      const state = oidc.randomState();
      const verifier = oidc.randomPKCECodeVerifier();
      const nonce = oidc.randomNonce();
      pending.set(state, { verifier, nonce, expiresAt: Date.now() + STATE_TTL_MS });
      const client = await discovery;
      const challenge = await oidc.calculatePKCECodeChallenge(verifier);
      const url = oidc.buildAuthorizationUrl(client, {
        redirect_uri: settings.redirectUri,
        response_type: "code",
        scope: "openid profile email",
        state,
        nonce,
        code_challenge: challenge,
        code_challenge_method: "S256",
      });
      return { url: url.href, cookie: cookie(STATE_COOKIE, state, 600, "Lax") };
    },
    async callback(request: FastifyRequest) {
      const state = cookies(request)[STATE_COOKIE];
      const login = state ? pending.get(state) : undefined;
      if (!state || !login || login.expiresAt <= Date.now())
        throw new PrCenterError(
          "Your sign-in request expired. Try again.",
          400,
          "INVALID_OIDC_STATE",
        );
      pending.delete(state);
      const query = request.query as Record<string, string | undefined>;
      const callback = new URL(settings.redirectUri);
      for (const [key, value] of Object.entries(query))
        if (value) callback.searchParams.set(key, value);
      let tokens: oidc.TokenEndpointResponse;
      try {
        tokens = await oidc.authorizationCodeGrant(await discovery, callback, {
          pkceCodeVerifier: login.verifier,
          expectedState: state,
          expectedNonce: login.nonce,
        });
      } catch {
        throw new PrCenterError(
          "Microsoft sign-in could not be completed. Try again or contact an administrator.",
          401,
          "OIDC_LOGIN_FAILED",
        );
      }
      const claims = (
        tokens as oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers
      ).claims();
      if (!claims)
        throw new PrCenterError(
          "Entra did not return an ID token",
          401,
          "INVALID_OIDC_TOKEN",
        );
      const actor = await provision(claims as Record<string, unknown>);
      const token = randomBytes(32).toString("base64url");
      sessions.set(token, { actor, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 });
      return {
        cookie: [
          cookie(SESSION_COOKIE, token, SESSION_TTL_SECONDS, "Strict"),
          cookie(STATE_COOKIE, "", 0, "Lax"),
        ],
        redirect: settings.postLogoutRedirectUri,
      };
    },
    signOut(request: FastifyRequest) {
      const token = cookies(request)[SESSION_COOKIE];
      if (token) sessions.delete(token);
      return cookie(SESSION_COOKIE, "", 0, "Strict");
    },
  };
}
