import { z } from "zod";
import {
  CONTENT_RESOURCES,
  RESOURCE_LABELS,
  type ContentResource,
} from "@/lib/permissions";
import { CATEGORIES } from "@/lib/content/categories";

// ─── Reusable content registry ────────────────────────────────────────────────
//
// One declarative config per manageable resource drives BOTH the generic admin
// form (which field inputs to render) and the generic server actions (zod
// validation + which public paths to revalidate). Per-table differences
// (procurement has no body/featured image; publications uses "description")
// are encoded here as data so there is a single form + single action codepath.

export type FieldType = "text" | "textarea" | "datetime";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /**
   * Bilingual field: rendered inside the Thai/English tabs and stored in a pair
   * of columns `${name}Th` / `${name}En`. Non-localized fields (slug, category,
   * publishedAt) are language-neutral and rendered once, outside the tabs.
   */
  localized?: boolean;
  /** Optional datalist suggestions for free-text fields (e.g. category). */
  suggestions?: string[];
  rows?: number;
}

export interface ContentFormConfig {
  resource: ContentResource;
  label: string;
  /** Whether this resource has a featured image column. */
  hasFeaturedImage: boolean;
  /** Text-ish fields rendered by the generic form, in display order. */
  fields: FieldDef[];
  /** Public paths to revalidate after a write. */
  revalidatePaths: string[];
  schema: z.ZodType;
}

// ─── Shared zod fragments ──────────────────────────────────────────────────────

const zText = z.string().trim();
// Slugs may contain Thai characters and hyphens; just forbid whitespace.
const zSlug = zText
  .min(1, "กรุณากรอก slug")
  .regex(/^[^\s/]+$/, "slug ต้องไม่มีช่องว่างหรือเครื่องหมาย / (no spaces or slashes)");
const zOptionalText = z.string().default("");

const zPublishedAt = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.union([z.coerce.date(), z.null()]),
);

const zFeaturedImageId = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.union([z.number().int().positive(), z.null()]),
);

const zAttachments = z.preprocess(
  (v) => {
    if (!v) return [];
    try {
      return JSON.parse(String(v));
    } catch {
      return [];
    }
  },
  z
    .array(
      z.object({
        name: z.string(),
        path: z.string(),
        mimeType: z.string().default(""),
      }),
    )
    .default([]),
);

const PUBLISHED_FIELD: FieldDef = { name: "publishedAt", label: "วันที่เผยแพร่ (Published at)", type: "datetime" };
const TITLE_FIELD: FieldDef = { name: "title", label: "หัวข้อ (Title)", type: "text", required: true, localized: true };
const SLUG_FIELD: FieldDef = { name: "slug", label: "Slug (URL)", type: "text", required: true };

function categoryField(suggestions: string[]): FieldDef {
  return { name: "category", label: "หมวดหมู่ (Category)", type: "text", suggestions };
}

/** Submitted form keys for a field — localized fields expand to `${name}Th`/`${name}En`. */
export function fieldNames(field: FieldDef): string[] {
  return field.localized ? [`${field.name}Th`, `${field.name}En`] : [field.name];
}

/**
 * Build a resource's zod schema from its field defs so the form fields and the
 * validation can never drift. Localized + required fields demand BOTH languages.
 */
function buildSchema(fields: FieldDef[], hasFeaturedImage: boolean): z.ZodType {
  const shape: Record<string, z.ZodTypeAny> = { attachments: zAttachments };
  if (hasFeaturedImage) shape.featuredImageId = zFeaturedImageId;

  for (const field of fields) {
    if (field.type === "datetime") {
      shape[field.name] = zPublishedAt;
    } else if (field.name === "slug") {
      shape.slug = zSlug;
    } else if (field.localized) {
      shape[`${field.name}Th`] = field.required
        ? zText.min(1, `กรุณากรอก${field.label} ภาษาไทย`)
        : zOptionalText;
      shape[`${field.name}En`] = field.required
        ? zText.min(1, `กรุณากรอก${field.label} ภาษาอังกฤษ (English required)`)
        : zOptionalText;
    } else {
      shape[field.name] = field.required
        ? zText.min(1, `กรุณากรอก${field.label}`)
        : zOptionalText;
    }
  }
  return z.object(shape);
}

function makeForm(cfg: {
  resource: ContentResource;
  hasFeaturedImage: boolean;
  fields: FieldDef[];
  revalidatePaths: string[];
}): ContentFormConfig {
  return {
    resource: cfg.resource,
    label: RESOURCE_LABELS[cfg.resource],
    hasFeaturedImage: cfg.hasFeaturedImage,
    fields: cfg.fields,
    revalidatePaths: cfg.revalidatePaths,
    schema: buildSchema(cfg.fields, cfg.hasFeaturedImage),
  };
}

// News categories are derived from CATEGORIES (the single source of truth for
// the /category landing pages) so a value chosen in the CMS always matches a
// real listing page — and a saved item shows up there.
const NEWS_CATEGORIES = [
  ...new Set(CATEGORIES.map((c) => c.newsCategory).filter((c): c is string => Boolean(c))),
];
// Landing-page paths (Thai + English) whose listings include news; revalidated
// after every news write so the new/edited item appears immediately.
const NEWS_CATEGORY_PATHS = CATEGORIES.filter((c) => c.newsCategory).map((c) => c.path);
const PROCUREMENT_CATEGORIES = ["ประกาศเชิญชวน", "ประกาศราคากลาง", "ประกาศผลผู้เสนอราคา", "ประกาศผลผู้ชนะ", "ร่างTOR", "ยกเลิก", "แผนการจัดซื้อ", "สขร."];
const PUBLICATION_CATEGORIES = ["หลักธรรมาภิบาล", "รายงานผล"];
const PROJECT_CATEGORIES = ["วิจัย-นวัตกรรม", "มาตรฐาน-ระบบทดสอบ", "การถ่ายทอดเทคโนโลยี", "ฐานข้อมูลเทคโนโลยี", "ยุทธศาสตร์-เทคโนโลยี", "พัฒนา-บุคลากร"];

export const CONTENT_FORMS: Record<ContentResource, ContentFormConfig> = {
  news: makeForm({
    resource: "news",
    hasFeaturedImage: true,
    fields: [
      TITLE_FIELD,
      { name: "excerpt", label: "เกริ่นนำ (Excerpt)", type: "textarea", rows: 3, localized: true },
      { name: "body", label: "เนื้อหา (Body)", type: "textarea", rows: 12, required: true, localized: true },
      SLUG_FIELD,
      categoryField(NEWS_CATEGORIES),
      PUBLISHED_FIELD,
    ],
    revalidatePaths: ["/", ...NEWS_CATEGORY_PATHS],
  }),
  procurement: makeForm({
    resource: "procurement",
    hasFeaturedImage: false,
    fields: [
      TITLE_FIELD,
      { name: "excerpt", label: "รายละเอียด (Excerpt)", type: "textarea", rows: 4, localized: true },
      SLUG_FIELD,
      categoryField(PROCUREMENT_CATEGORIES),
      PUBLISHED_FIELD,
    ],
    revalidatePaths: ["/จัดซื้อจัดจ้าง"],
  }),
  publications: makeForm({
    resource: "publications",
    hasFeaturedImage: true,
    fields: [
      TITLE_FIELD,
      { name: "description", label: "คำอธิบาย (Description)", type: "textarea", rows: 6, localized: true },
      SLUG_FIELD,
      categoryField(PUBLICATION_CATEGORIES),
      PUBLISHED_FIELD,
    ],
    revalidatePaths: ["/เอกสารเผยแพร่"],
  }),
  featuredProjects: makeForm({
    resource: "featuredProjects",
    hasFeaturedImage: true,
    fields: [
      TITLE_FIELD,
      { name: "excerpt", label: "เกริ่นนำ (Excerpt)", type: "textarea", rows: 3, localized: true },
      { name: "body", label: "เนื้อหา (Body)", type: "textarea", rows: 12, required: true, localized: true },
      SLUG_FIELD,
      categoryField(PROJECT_CATEGORIES),
      PUBLISHED_FIELD,
    ],
    revalidatePaths: ["/ผลงานและโครงการเด่น"],
  }),
};

export function getContentForm(resource: ContentResource): ContentFormConfig {
  return CONTENT_FORMS[resource];
}

export type ParseResult =
  | { success: true; data: Record<string, unknown> }
  | { success: false; errors: Record<string, string> };

/** Validate a submitted FormData against the resource's schema. */
export function parseContentForm(
  resource: ContentResource,
  formData: FormData,
): ParseResult {
  const config = CONTENT_FORMS[resource];
  const raw: Record<string, FormDataEntryValue | null> = {
    attachments: formData.get("attachments"),
  };
  if (config.hasFeaturedImage) raw.featuredImageId = formData.get("featuredImageId");
  // Pull every field the form submits (localized fields → `${name}Th`/`${name}En`).
  for (const field of config.fields) {
    for (const key of fieldNames(field)) {
      raw[key] = formData.get(key);
    }
  }

  const parsed = config.schema.safeParse(raw);
  if (parsed.success) {
    return { success: true, data: parsed.data as Record<string, unknown> };
  }
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? "_form");
    if (!errors[field]) errors[field] = issue.message;
  }
  return { success: false, errors };
}

export { CONTENT_RESOURCES };
