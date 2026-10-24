import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import Fastify from "fastify";
import * as oidc from "openid-client";
export const ACTIVITY_VIEWER_ROLE = "RTRDA_ACTIVITY_REPORT_VIEWER";
const SESSION = "rtrda_activity_oidc_session",
  STATE = "rtrda_activity_oidc_state",
  TTL = 1800000;
const cookie = (name: string, value: string, age: number, site: string) =>
  `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=${site}; Max-Age=${age}`;
const value = (header: string | undefined, name: string) =>
  header
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(`${name}=`))
    ?.slice(name.length + 1);
export class AuthDenied extends Error {
  constructor(readonly statusCode: number) {
    super("Authentication denied");
  }
}
export type VerifiedClaims = {
  iss?: unknown;
  aud?: unknown;
  tid?: unknown;
  sub?: unknown;
  exp?: unknown;
  roles?: unknown;
};
export type Settings = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  issuer: string;
  redirectUri: string;
};
export type Gateway = {
  begin: (input: { state: string; nonce: string; verifier: string }) => Promise<string>;
  exchange: (input: {
    callback: URL;
    expectedState: string;
    expectedNonce: string;
    pkceCodeVerifier: string;
  }) => Promise<VerifiedClaims>;
};
export function activitySettings(): Settings | null {
  const {
    ACTIVITY_OIDC_TENANT_ID: tenantId,
    ACTIVITY_OIDC_CLIENT_ID: clientId,
    ACTIVITY_OIDC_CLIENT_SECRET: clientSecret,
    ACTIVITY_OIDC_ISSUER: issuer,
    ACTIVITY_OIDC_REDIRECT_URI: redirectUri,
  } = process.env.ACTIVITY_OIDC_FILE
    ? (() => {
        try {
          const keys = new Set([
            "ACTIVITY_OIDC_TENANT_ID",
            "ACTIVITY_OIDC_CLIENT_ID",
            "ACTIVITY_OIDC_CLIENT_SECRET",
            "ACTIVITY_OIDC_ISSUER",
            "ACTIVITY_OIDC_REDIRECT_URI",
          ]);
          const values: Record<string, string> = {};
          for (const line of readFileSync(process.env.ACTIVITY_OIDC_FILE!, "utf8").split(
            /\r?\n/,
          )) {
            if (!line || line.startsWith("#")) continue;
            const separator = line.indexOf("=");
            const key = line.slice(0, separator);
            const entry = line.slice(separator + 1);
            if (
              separator < 0 ||
              !keys.has(key) ||
              key in values ||
              !/^[A-Za-z0-9_./:@-]+$/.test(entry)
            )
              return {};
            values[key] = entry;
          }
          return Object.keys(values).length === keys.size ? values : {};
        } catch {
          return {};
        }
      })()
    : process.env;
  if (
    !tenantId ||
    !clientId ||
    !clientSecret ||
    !issuer ||
    !redirectUri ||
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(tenantId)
  )
    return null;
  if (issuer !== `https://login.microsoftonline.com/${tenantId}/v2.0`) return null;
  if (redirectUri !== "https://rtrda.or.th/api/analytics/activity-auth/callback")
    return null;
  return { tenantId, clientId, clientSecret, issuer, redirectUri };
}
export function entraGateway(settings: Settings): Gateway {
  const discovery = oidc
    .discovery(new URL(settings.issuer), settings.clientId, settings.clientSecret)
    .then((client) => {
      if (client.serverMetadata().issuer !== settings.issuer) throw new AuthDenied(503);
      return client;
    });
  return {
    async begin({ state, nonce, verifier }) {
      return oidc.buildAuthorizationUrl(await discovery, {
        redirect_uri: settings.redirectUri,
        response_type: "code",
        scope: "openid",
        state,
        nonce,
        code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
        code_challenge_method: "S256",
      }).href;
    },
    async exchange({ callback, expectedState, expectedNonce, pkceCodeVerifier }) {
      const tokens = await oidc.authorizationCodeGrant(await discovery, callback, {
        expectedState,
        expectedNonce,
        pkceCodeVerifier,
      });
      const claims = (
        tokens as oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers
      ).claims();
      if (!claims) throw new AuthDenied(401);
      return claims;
    },
  };
}
export function createActivityAuth(
  settings: Settings,
  gateway: Gateway = entraGateway(settings),
) {
  const pending = new Map<string, { nonce: string; verifier: string; expires: number }>();
  const sessions = new Map<string, number>();
  return {
    async begin() {
      const state = oidc.randomState(),
        nonce = oidc.randomNonce(),
        verifier = oidc.randomPKCECodeVerifier();
      pending.set(state, { nonce, verifier, expires: Date.now() + 600000 });
      try {
        return {
          url: await gateway.begin({ state, nonce, verifier }),
          state,
          cookie: cookie(STATE, state, 600, "Lax"),
        };
      } catch {
        pending.delete(state);
        throw new AuthDenied(503);
      }
    },
    async callback(input: { cookie?: string; state?: string; code?: string }) {
      const state = value(input.cookie, STATE),
        attempt = state && pending.get(state);
      if (
        !state ||
        !attempt ||
        attempt.expires <= Date.now() ||
        input.state !== state ||
        !input.code
      )
        throw new AuthDenied(400);
      pending.delete(state);
      const callback = new URL(settings.redirectUri);
      callback.searchParams.set("state", input.state);
      callback.searchParams.set("code", input.code);
      let claims: VerifiedClaims;
      try {
        claims = await gateway.exchange({
          callback,
          expectedState: state,
          expectedNonce: attempt.nonce,
          pkceCodeVerifier: attempt.verifier,
        });
      } catch {
        throw new AuthDenied(401);
      }
      if (
        claims.iss !== settings.issuer ||
        claims.aud !== settings.clientId ||
        claims.tid !== settings.tenantId ||
        typeof claims.sub !== "string" ||
        !claims.sub ||
        typeof claims.exp !== "number" ||
        claims.exp * 1000 <= Date.now() ||
        !Array.isArray(claims.roles) ||
        !claims.roles.includes(ACTIVITY_VIEWER_ROLE)
      )
        throw new AuthDenied(403);
      const token = randomBytes(32).toString("base64url"),
        expires = Math.min(Date.now() + TTL, claims.exp * 1000);
      sessions.set(token, expires);
      return {
        cookie: cookie(
          SESSION,
          token,
          Math.max(1, Math.floor((expires - Date.now()) / 1000)),
          "Strict",
        ),
        clearState: cookie(STATE, "", 0, "Lax"),
      };
    },
    resolve(header?: string) {
      const token = value(header, SESSION);
      if (!token) return false;
      const expires = sessions.get(token);
      if (!expires || expires <= Date.now()) {
        sessions.delete(token);
        return false;
      }
      return true;
    },
    logout(header?: string) {
      const token = value(header, SESSION);
      if (token) sessions.delete(token);
      return [cookie(SESSION, "", 0, "Strict"), cookie(STATE, "", 0, "Lax")];
    },
  };
}
export function buildActivityAuthApi(auth: ReturnType<typeof createActivityAuth>) {
  const app = Fastify({ logger: false });
  app.setErrorHandler((error, _request, reply) =>
    reply
      .status(error instanceof AuthDenied ? error.statusCode : 503)
      .send({ error: "Authentication unavailable or denied" }),
  );
  app.get("/healthz", async (_request, reply) =>
    activitySettings() ? { ok: true } : reply.status(503).send({ ok: false }),
  );
  app.get("/auth/login", async (_request, reply) => {
    const start = await auth.begin();
    return reply.header("Set-Cookie", start.cookie).redirect(start.url);
  });
  app.get("/auth/callback", async (request, reply) => {
    const query = request.query as { state?: string; code?: string };
    try {
      const result = await auth.callback({
        cookie: request.headers.cookie,
        state: query.state,
        code: query.code,
      });
      return reply
        .header("Set-Cookie", [result.cookie, result.clearState])
        .redirect("/rtrdaintranet/activity-log");
    } catch {
      return reply
        .header("Set-Cookie", auth.logout(request.headers.cookie))
        .redirect("/rtrdaintranet/activity-log?signin=failed");
    }
  });
  app.post("/auth/logout", async (request, reply) =>
    reply
      .header("Set-Cookie", auth.logout(request.headers.cookie))
      .redirect("/rtrdaintranet/activity-log"),
  );
  app.get("/session", async (request, reply) =>
    auth.resolve(request.headers.cookie)
      ? { authorized: true }
      : reply.status(401).send({ error: "Sign in required" }),
  );
  return app;
}
