"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getContentForm,
  parseContentForm,
  type ContentFormConfig,
} from "@/lib/content-config";
import { isUserRole, type ContentResource } from "@/lib/permissions";
import {
  requireAdmin,
  requirePermission,
} from "@/lib/session";
import {
  countAdmins,
  deleteContent,
  insertContent,
  listUsers,
  setUserRole,
  updateContent,
} from "@/db/queries";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
};

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "23505"
  );
}

const SLUG_TAKEN: ActionState = {
  error: "slug นี้มีอยู่แล้ว — กรุณาใช้ค่าอื่น (slug already exists)",
  fieldErrors: { slug: "slug ซ้ำ" },
};

/**
 * Purge the caches a content write affects: the resource's listing/landing pages
 * plus the item's own article page (`/{slug}` and the `/en/` twin), so the change
 * is visible immediately on the public site.
 */
function revalidateContent(config: ContentFormConfig, data: Record<string, unknown>) {
  for (const p of config.revalidatePaths) revalidatePath(p);
  const slug = data.slug;
  if (typeof slug === "string" && slug) {
    revalidatePath(`/${slug}`);
    revalidatePath(`/en/${slug}`);
  }
}

// ─── Content CRUD ───────────────────────────────────────────────────────────

export async function createContentAction(
  resource: ContentResource,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(resource); // throws ForbiddenError / redirects to login
  const config = getContentForm(resource);

  const parsed = parseContentForm(resource, formData);
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    await insertContent(resource, parsed.data);
  } catch (e) {
    if (isUniqueViolation(e)) return SLUG_TAKEN;
    throw e;
  }

  revalidateContent(config, parsed.data);
  redirect(`/rtrdaintranet/manage/${resource}`);
}

export async function updateContentAction(
  resource: ContentResource,
  id: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission(resource);
  const config = getContentForm(resource);

  const parsed = parseContentForm(resource, formData);
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    await updateContent(resource, id, parsed.data);
  } catch (e) {
    if (isUniqueViolation(e)) return SLUG_TAKEN;
    throw e;
  }

  revalidateContent(config, parsed.data);
  redirect(`/rtrdaintranet/manage/${resource}`);
}

export async function deleteContentAction(
  resource: ContentResource,
  id: number,
): Promise<void> {
  await requirePermission(resource);
  const config = getContentForm(resource);
  await deleteContent(resource, id);
  for (const p of config.revalidatePaths) revalidatePath(p);
  revalidatePath(`/rtrdaintranet/manage/${resource}`);
}

// ─── User role administration (admin only) ──────────────────────────────────

export async function setUserRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!userId) return { error: "Missing user id" };
  if (!isUserRole(role)) return { error: "Invalid role" };

  // Never strip the last remaining admin of their access.
  if (role !== "admin") {
    const users = await listUsers();
    const target = users.find((u) => u.id === userId);
    if (target?.role === "admin" && (await countAdmins()) <= 1) {
      return { error: "ไม่สามารถถอดสิทธิ์ admin คนสุดท้ายได้ (cannot demote the last admin)" };
    }
  }

  await setUserRole(userId, role);
  revalidatePath("/rtrdaintranet/manage/users");
  return { success: true };
}
