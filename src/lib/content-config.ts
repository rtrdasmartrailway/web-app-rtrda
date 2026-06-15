import { z } from "zod";
import {
  CONTENT_RESOURCES,
  RESOURCE_LABELS,
  type ContentResource,
} from "@/lib/permissions";

// ─── Reusable content registry ────────────────────────────────────────────────
//
// One declarative config per manageable resource drives BOTH the generic admin
// form (which field inputs to render) and the generic server actions (zod
// validation + which public paths to revalidate). Per-table differences
// (procurement has no body/featured image; publications uses "description")
// are encoded here as data so there is a single form + single action codepath.

export type FieldType = "text" | "textarea" | "datetime" | "language";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
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
const zTitle = zText.min(1, "กรุณากรอกหัวข้อ (title is required)");
// Slugs may contain Thai characters and hyphens; just forbid whitespace.
const zSlug = zText
  .min(1, "กรุณากรอก slug")
  .regex(/^[^\s/]+$/, "slug ต้องไม่มีช่องว่างหรือเครื่องหมาย / (no spaces or slashes)");
const zLanguage = z.enum(["th", "en"]).default("th");
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

const common = {
  title: zTitle,
  slug: zSlug,
  language: zLanguage,
  category: zOptionalText,
  publishedAt: zPublishedAt,
  attachments: zAttachments,
};

const LANGUAGE_FIELD: FieldDef = { name: "language", label: "ภาษา (Language)", type: "language" };
const PUBLISHED_FIELD: FieldDef = { name: "publishedAt", label: "วันที่เผยแพร่ (Published at)", type: "datetime" };

function titleSlugFields(categorySuggestions: string[]): FieldDef[] {
  return [
    { name: "title", label: "หัวข้อ (Title)", type: "text", required: true },
    { name: "slug", label: "Slug (URL)", type: "text", required: true },
    { name: "category", label: "หมวดหมู่ (Category)", type: "text", suggestions: categorySuggestions },
    LANGUAGE_FIELD,
  ];
}

const NEWS_CATEGORIES = ["ข่าว-กิจกรรม", "ความร่วมมือ", "ทันข่าวเทคโนโลยีระบบราง", "อบรม-สัมมนา", "ประกาศ", "บทความ"];
const PROCUREMENT_CATEGORIES = ["ประกาศเชิญชวน", "ประกาศราคากลาง", "ประกาศผลผู้เสนอราคา", "ประกาศผลผู้ชนะ", "ร่างTOR", "ยกเลิก", "แผนการจัดซื้อ", "สขร."];
const PUBLICATION_CATEGORIES = ["หลักธรรมาภิบาล", "รายงานผล"];
const PROJECT_CATEGORIES = ["วิจัย-นวัตกรรม", "มาตรฐาน-ระบบทดสอบ", "การถ่ายทอดเทคโนโลยี", "ฐานข้อมูลเทคโนโลยี", "ยุทธศาสตร์-เทคโนโลยี", "พัฒนา-บุคลากร"];

export const CONTENT_FORMS: Record<ContentResource, ContentFormConfig> = {
  news: {
    resource: "news",
    label: RESOURCE_LABELS.news,
    hasFeaturedImage: true,
    fields: [
      ...titleSlugFields(NEWS_CATEGORIES),
      { name: "excerpt", label: "เกริ่นนำ (Excerpt)", type: "textarea", rows: 3 },
      { name: "body", label: "เนื้อหา (Body)", type: "textarea", rows: 12 },
      PUBLISHED_FIELD,
    ],
    revalidatePaths: ["/ข่าวสาร-กิจกรรม", "/"],
    schema: z.object({ ...common, excerpt: zOptionalText, body: zOptionalText, featuredImageId: zFeaturedImageId }),
  },
  procurement: {
    resource: "procurement",
    label: RESOURCE_LABELS.procurement,
    hasFeaturedImage: false,
    fields: [
      ...titleSlugFields(PROCUREMENT_CATEGORIES),
      { name: "excerpt", label: "รายละเอียด (Excerpt)", type: "textarea", rows: 4 },
      PUBLISHED_FIELD,
    ],
    revalidatePaths: ["/จัดซื้อจัดจ้าง"],
    schema: z.object({ ...common, excerpt: zOptionalText }),
  },
  publications: {
    resource: "publications",
    label: RESOURCE_LABELS.publications,
    hasFeaturedImage: true,
    fields: [
      ...titleSlugFields(PUBLICATION_CATEGORIES),
      { name: "description", label: "คำอธิบาย (Description)", type: "textarea", rows: 6 },
      PUBLISHED_FIELD,
    ],
    revalidatePaths: ["/เอกสารเผยแพร่"],
    schema: z.object({ ...common, description: zOptionalText, featuredImageId: zFeaturedImageId }),
  },
  featuredProjects: {
    resource: "featuredProjects",
    label: RESOURCE_LABELS.featuredProjects,
    hasFeaturedImage: true,
    fields: [
      ...titleSlugFields(PROJECT_CATEGORIES),
      { name: "excerpt", label: "เกริ่นนำ (Excerpt)", type: "textarea", rows: 3 },
      { name: "body", label: "เนื้อหา (Body)", type: "textarea", rows: 12 },
      PUBLISHED_FIELD,
    ],
    revalidatePaths: ["/ผลงานและโครงการเด่น"],
    schema: z.object({ ...common, excerpt: zOptionalText, body: zOptionalText, featuredImageId: zFeaturedImageId }),
  },
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
  const raw: Record<string, FormDataEntryValue | null> = {};
  // Pull every field the form may submit; the schema picks what it needs.
  for (const key of [
    "title",
    "slug",
    "language",
    "category",
    "excerpt",
    "body",
    "description",
    "publishedAt",
    "featuredImageId",
    "attachments",
  ]) {
    raw[key] = formData.get(key);
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
