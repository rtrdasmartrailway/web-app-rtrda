// ─── RBAC: single source of truth ────────────────────────────────────────────
//
// Pure data + functions — no DB access, no secrets. Safe to import from both
// server (route handlers / server actions) and client (UI gating) code.
//
// Roles classify intranet users; each role may create/edit/delete a fixed set
// of content resources. New Microsoft logins default to "none" (no access)
// until an admin grants them a role.

export const CONTENT_RESOURCES = [
  "news",
  "procurement",
  "publications",
  "featuredProjects",
] as const;

export type ContentResource = (typeof CONTENT_RESOURCES)[number];

export const ROLES = ["admin", "procurement", "pr", "researcher", "none"] as const;

export type UserRole = (typeof ROLES)[number];

/** role → content resources the role may create / edit / delete */
const PERMISSIONS: Record<UserRole, readonly ContentResource[]> = {
  admin: CONTENT_RESOURCES, // all content types
  procurement: ["procurement"],
  pr: ["news"], // "announcements" are modelled as a news category
  researcher: ["featuredProjects", "publications"], // projects & papers
  none: [],
};

/** Human-readable labels for each resource (Thai / English). */
export const RESOURCE_LABELS: Record<ContentResource, string> = {
  news: "ข่าวสาร-กิจกรรม (News)",
  procurement: "จัดซื้อจัดจ้าง (Procurement)",
  publications: "เอกสารเผยแพร่ (Publications)",
  featuredProjects: "ผลงานและโครงการเด่น (Featured Projects)",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin — ผู้ดูแลระบบ",
  procurement: "Procurement — จัดซื้อจัดจ้าง",
  pr: "PR — ประชาสัมพันธ์",
  researcher: "Researcher — นักวิจัย",
  none: "No access — ยังไม่ได้รับสิทธิ์",
};

export function isContentResource(value: string): value is ContentResource {
  return (CONTENT_RESOURCES as readonly string[]).includes(value);
}

export function isUserRole(value: string): value is UserRole {
  return (ROLES as readonly string[]).includes(value);
}

/** Normalize an arbitrary stored role string to a known role (defaults to "none"). */
export function asRole(value: string | null | undefined): UserRole {
  return value && isUserRole(value) ? value : "none";
}

/** Whether `role` may create/edit/delete the given content `resource`. */
export function canManage(role: UserRole, resource: ContentResource): boolean {
  return PERMISSIONS[role].includes(resource);
}

/** The content resources a role is allowed to manage. */
export function allowedResources(role: UserRole): ContentResource[] {
  return [...PERMISSIONS[role]];
}

export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}
