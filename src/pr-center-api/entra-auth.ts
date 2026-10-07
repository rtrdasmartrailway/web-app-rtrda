import { randomBytes } from "node:crypto";
import * as oidc from "openid-client";
import type { FastifyRequest } from "fastify";
import { prisma } from "@/lib/db/client";
import {
  PrCenterError,
  type PrCenterActor,
  type PrCenterRoleGrant,
} from "@/lib/pr-center/service";
import type { PrCenterRole } from "@/lib/pr-center/workflow";
import {
  isRootPrCenterAdministrator,
  ROOT_PR_CENTER_ADMIN_EMAIL,
} from "@/lib/pr-center/access-authority";

const SESSION_COOKIE = "rtrda_pr_center_oidc_session";
const STATE_COOKIE = "rtrda_pr_center_oidc_state";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const STATE_TTL_MS = 10 * 60 * 1000;

type Session = { actor: PrCenterActor; expiresAt: number };
type PendingLogin = { verifier: string; nonce: string; expiresAt: number };

function oidcErrorCode(error: unknown): string {
  const value =
    error &&
    typeof error === "object" &&
    "error" in error &&
    typeof error.error === "string"
      ? error.error
      : "";
  const allowed = new Set([
    "invalid_client",
    "invalid_grant",
    "invalid_request",
    "invalid_scope",
    "server_error",
    "temporarily_unavailable",
    "unauthorized_client",
  ]);
  return allowed.has(value) ? value.toUpperCase() : "UNKNOWN";
}

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

type SessionAuthorityRecord = {
  active: boolean;
  email: string;
  organizationId: string;
  departmentId: string | null;
  roles: Array<{
    role: PrCenterRole;
    organizationId: string;
    departmentId: string | null;
  }>;
};

export function isSessionAuthorityCurrent(
  actor: PrCenterActor,
  user: SessionAuthorityRecord | null,
): boolean {
  if (
    !user?.active ||
    !isAllowedOrganizationEmail(user.email) ||
    user.organizationId !== actor.organizationId ||
    user.departmentId !== actor.departmentId
  )
    return false;

  const expectedGrants = actor.roleGrants ?? [
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
  const currentGrants = user.roles
    .filter((assigned) => assigned.organizationId === actor.organizationId)
    .map(({ role, departmentId }) => ({ role, departmentId }));
  const key = (grant: PrCenterRoleGrant) => `${grant.role}:${grant.departmentId ?? "*"}`;
  const expected = expectedGrants.map(key).sort();
  const current = currentGrants.map(key).sort();
  const grantsMatch =
    expected.length === current.length &&
    expected.every((grant, index) => grant === current[index]);
  return (
    grantsMatch &&
    Boolean(actor.isRootAdministrator) === isRootPrCenterAdministrator(user.email)
  );
}

type ExistingIdentity = {
  id: string;
  active: boolean;
  organizationId: string;
};

export function validateIdentityMapping<T extends ExistingIdentity>(
  existingBySubject: T | null,
  existingByEmail: T | null,
  organizationId: string,
): T | null {
  if (existingByEmail && existingByEmail.id !== existingBySubject?.id)
    throw new PrCenterError(
      "This email is already linked to a different SSO identity",
      403,
      "OIDC_IDENTITY_MISMATCH",
    );
  const existingUser = existingBySubject ?? existingByEmail;
  if (existingUser && !existingUser.active)
    throw new PrCenterError(
      "Your PR Center account is disabled. Contact an administrator.",
      403,
      "ACCOUNT_DISABLED",
    );
  if (existingUser && existingUser.organizationId !== organizationId)
    throw new PrCenterError(
      "Your SSO identity is linked to a different organization",
      403,
      "OIDC_ORGANIZATION_MISMATCH",
    );
  return existingUser;
}

const EXPLICITLY_ALLOWED_PR_CENTER_EMAILS = new Set([ROOT_PR_CENTER_ADMIN_EMAIL]);

export function isAllowedOrganizationEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf("@");
  return (
    EXPLICITLY_ALLOWED_PR_CENTER_EMAILS.has(normalized) ||
    (at > 0 &&
      at === normalized.lastIndexOf("@") &&
      normalized.slice(at + 1) === "rtrda.or.th")
  );
}

export function resolvePrCenterLoginRole(
  email: string,
  databaseRoleAssignments: ReadonlyArray<PrCenterRoleGrant>,
): {
  role: PrCenterRole;
  roleGrants: PrCenterRoleGrant[];
  autoProvisionRequester: boolean;
} {
  if (!isAllowedOrganizationEmail(email))
    throw new PrCenterError(
      "Only @rtrda.or.th users may access PR Center",
      403,
      "OIDC_ACCESS_NOT_ALLOWED",
    );
  const roleGrants = [...databaseRoleAssignments];
  const autoProvisionRequester = !roleGrants.some((grant) => grant.role === "REQUESTER");
  if (autoProvisionRequester) roleGrants.push({ role: "REQUESTER", departmentId: null });
  const role =
    roleGrants.find((grant) => grant.role !== "REQUESTER")?.role ?? "REQUESTER";
  return { role, roleGrants, autoProvisionRequester };
}

function config() {
  const tenantId = process.env.ENTRA_TENANT_ID;
  const clientId = process.env.ENTRA_CLIENT_ID;
  const clientSecret =
    process.env.ENTRA_CLIENT_SECRET_VALUE || process.env.ENTRA_CLIENT_SECRET;
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
    if (!oid)
      throw new PrCenterError(
        "Your Entra account has no stable subject identifier",
        403,
        "OIDC_MISSING_SUBJECT",
      );
    if (tid !== oidcSettings.tenantId)
      throw new PrCenterError(
        "Your Entra account belongs to a different tenant",
        403,
        "OIDC_TENANT_MISMATCH",
      );
    const email =
      typeof claims.preferred_username === "string"
        ? claims.preferred_username.trim().toLowerCase()
        : "";
    const displayName =
      typeof claims.name === "string" ? claims.name : email || "RTRDA user";
    if (!email)
      throw new PrCenterError(
        "Your Entra account has no organization email",
        403,
        "OIDC_MISSING_EMAIL",
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
      const ssoSubject = `entra:${oid}`;
      const existingBySubject = await tx.prCenterUser.findUnique({
        where: { ssoSubject },
        include: { roles: true },
      });
      const existingByEmail = await tx.prCenterUser.findUnique({
        where: { email },
        include: { roles: true },
      });
      const existingUser = validateIdentityMapping(
        existingBySubject,
        existingByEmail,
        organization.id,
      );
      const eligibleAssignments = existingUser
        ? existingUser.roles.filter(
            (assigned) => assigned.organizationId === organization.id,
          )
        : [];
      const databaseRoleAssignments = eligibleAssignments.map(
        ({ role, departmentId }) => ({
          role,
          departmentId,
        }),
      );
      const loginRole = resolvePrCenterLoginRole(email, databaseRoleAssignments);
      const {
        role: resolvedRole,
        roleGrants: resolvedRoleGrants,
        autoProvisionRequester,
      } = loginRole;
      const roleGrants = [...resolvedRoleGrants];
      const isRootAdministrator = isRootPrCenterAdministrator(email);
      let role = resolvedRole;
      const user = existingUser
        ? await tx.prCenterUser.update({
            where: { id: existingUser.id },
            data: {
              email,
              displayName,
              organizationId: organization.id,
              ...(autoProvisionRequester && !existingUser.departmentId
                ? { departmentId: department.id }
                : {}),
            },
          })
        : await tx.prCenterUser.create({
            data: {
              organizationId: organization.id,
              departmentId: department.id,
              ssoSubject,
              email,
              displayName,
              active: true,
            },
          });
      if (autoProvisionRequester) {
        const existingRole = await tx.prUserRole.findFirst({
          where: {
            userId: user.id,
            role: "REQUESTER",
            organizationId: organization.id,
            departmentId: null,
          },
        });
        if (!existingRole)
          await tx.prUserRole.create({
            data: { userId: user.id, role: "REQUESTER", organizationId: organization.id },
          });
      }
      if (isRootAdministrator) {
        const hasOrganizationAdmin = roleGrants.some(
          (grant) => grant.role === "SCOPED_ADMINISTRATOR" && grant.departmentId === null,
        );
        if (!hasOrganizationAdmin) {
          await tx.prUserRole.create({
            data: {
              userId: user.id,
              role: "SCOPED_ADMINISTRATOR",
              organizationId: organization.id,
              departmentId: null,
            },
          });
          roleGrants.push({ role: "SCOPED_ADMINISTRATOR", departmentId: null });
        }
        role = "SCOPED_ADMINISTRATOR";
      }
      await tx.prAuditEvent.create({
        data: {
          organizationId: organization.id,
          actorId: user.id,
          action: "auth.oidc_login",
          entityType: "session",
          entityId: user.id,
          correlationId: randomBytes(16).toString("hex"),
          after: { roles: roleGrants },
        },
      });
      return {
        id: user.id,
        organizationId: organization.id,
        departmentId: user.departmentId,
        role,
        roleGrants,
        isRootAdministrator,
        scopeDepartmentId: isRootAdministrator
          ? null
          : (roleGrants.find((grant) => grant.role !== "REQUESTER")?.departmentId ??
            null),
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
      const user = await prisma.prCenterUser.findFirst({
        where: {
          id: session.actor.id,
          organizationId: session.actor.organizationId,
        },
        select: {
          active: true,
          email: true,
          organizationId: true,
          departmentId: true,
          roles: {
            select: { role: true, organizationId: true, departmentId: true },
          },
        },
      });
      if (!isSessionAuthorityCurrent(session.actor, user)) {
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
      } catch (error) {
        throw new PrCenterError(
          "Microsoft sign-in could not be completed. Try again or contact an administrator.",
          401,
          `OIDC_TOKEN_EXCHANGE_${oidcErrorCode(error)}`,
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
      return [
        cookie(SESSION_COOKIE, "", 0, "Strict"),
        cookie(STATE_COOKIE, "", 0, "Lax"),
      ];
    },
  };
}
