import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  asRole,
  canManage,
  type ContentResource,
  type UserRole,
} from "@/lib/permissions";

const LOGIN_PATH = "/rtrdaintranet/login";

// DEV-ONLY auth bypass: when enabled, the app treats every request as a
// synthetic admin so the content-management features can be exercised without a
// real Microsoft sign-in. Double-guarded so it can NEVER activate in production.
export const DEV_AUTH_BYPASS =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "1";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: UserRole;
};

const DEV_ADMIN: CurrentUser = {
  id: "dev-admin",
  name: "Dev Admin (bypass)",
  email: "dev-admin@localhost",
  image: null,
  role: "admin",
};

/** Thrown by requirePermission/requireAdmin; route handlers map it to 403. */
export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Read the signed-in user (or null). Safe in RSC, route handlers, server actions. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (DEV_AUTH_BYPASS) return DEV_ADMIN;
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result?.user) return null;
  const u = result.user as typeof result.user & { role?: string };
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    role: asRole(u.role),
  };
}

/** Require a signed-in user; redirect to login otherwise. For pages/layouts. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}

/** Require permission to manage a content resource. Throws ForbiddenError. */
export async function requirePermission(
  resource: ContentResource,
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  if (!canManage(user.role, resource)) {
    throw new ForbiddenError(`Role "${user.role}" may not manage "${resource}".`);
  }
  return user;
}

/** Require an admin. Throws ForbiddenError for non-admins. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  if (user.role !== "admin") {
    throw new ForbiddenError("Admin access required.");
  }
  return user;
}
