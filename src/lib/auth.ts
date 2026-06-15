import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

// Auth is meaningless without a database — fail loudly rather than silently
// degrade, so misconfiguration is caught immediately in dev/CI.
if (!db) {
  throw new Error(
    "DATABASE_URL is required for authentication. Set it in .env.local before running the app.",
  );
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  // Microsoft Entra ID (Azure AD) sign-in. Redirect URI to register in the
  // Entra app: <BETTER_AUTH_URL>/api/auth/callback/microsoft
  socialProviders: {
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID as string,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET as string,
      // "common" allows any Microsoft account; set MICROSOFT_TENANT_ID to your
      // tenant GUID to restrict sign-in to your organization only.
      tenantId: process.env.MICROSOFT_TENANT_ID || "common",
    },
  },
  user: {
    additionalFields: {
      // RBAC role. input:false => clients can never set it via sign-up/update;
      // the only write path is the admin-only setUserRoleAction server action.
      role: {
        type: "string",
        required: false,
        defaultValue: "none",
        input: false,
      },
    },
  },
  // nextCookies() must be the last plugin: it forwards Set-Cookie headers from
  // server actions so sign-in/out work without manual cookie plumbing.
  plugins: [nextCookies()],
});
