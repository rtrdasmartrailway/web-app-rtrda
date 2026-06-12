import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// ─── Legacy WordPress import tables (kept for backward compatibility) ─────────

export const wpContent = pgTable(
  "wp_content",
  {
    id: serial("id").primaryKey(),
    wpId: text("wp_id").notNull(),
    language: text("language").notNull(),
    kind: text("kind").notNull(),
    path: text("path").notNull().unique(),
    sourceUrl: text("source_url").notNull().default(""),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    contentHtml: text("content_html").notNull().default(""),
    modified: text("modified").notNull().default(""),
    date: text("date").notNull().default(""),
    parentPath: text("parent_path"),
    featuredMediaId: text("featured_media_id"),
    featuredMediaPath: text("featured_media_path"),
  },
  (t) => [index("wp_content_language_idx").on(t.language), index("wp_content_parent_path_idx").on(t.parentPath)],
);

export const wpMedia = pgTable("wp_media", {
  id: serial("id").primaryKey(),
  wpId: text("wp_id").notNull(),
  sourceUrl: text("source_url").notNull().default(""),
  localPath: text("local_path").notNull(),
  title: text("title").notNull().default(""),
  alt: text("alt").notNull().default(""),
  width: integer("width"),
  height: integer("height"),
  mimeType: text("mime_type").notNull().default(""),
});

export const wpDownloads = pgTable("wp_downloads", {
  id: text("id").primaryKey(),
  sourceUrl: text("source_url").notNull().default(""),
  localPath: text("local_path").notNull(),
  fileName: text("file_name").notNull().default(""),
  mimeType: text("mime_type").notNull().default(""),
  sizeBytes: integer("size_bytes").notNull().default(0),
  title: text("title").notNull().default(""),
  group: text("group").notNull().default(""),
});

export const wpNavigation = pgTable("wp_navigation", {
  id: serial("id").primaryKey(),
  language: text("language").notNull(),
  label: text("label").notNull(),
  href: text("href").notNull(),
  path: text("path"),
  external: boolean("external").notNull().default(false),
  parentId: integer("parent_id"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const wpMeta = pgTable("wp_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// ─── Shared type ──────────────────────────────────────────────────────────────

type Attachment = { name: string; path: string; mimeType: string };

// ─── Media — central file/image registry (local filesystem paths) ─────────────

export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  filePath: text("file_path").notNull(),
  mimeType: text("mime_type").notNull().default(""),
  sizeBytes: integer("size_bytes"),
  width: integer("width"),
  height: integer("height"),
  altText: text("alt_text").notNull().default(""),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow(),
});

// ─── News — ข่าวสาร-กิจกรรม ───────────────────────────────────────────────────

export const news = pgTable(
  "news",
  {
    id: serial("id").primaryKey(),
    language: text("language").notNull().default("th"),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    body: text("body").notNull().default(""),
    // ข่าว-กิจกรรม / ความร่วมมือ / ทันข่าวเทคโนโลยี / อบรม-สัมมนา
    category: text("category").notNull().default(""),
    featuredImageId: integer("featured_image_id").references(() => media.id),
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default([]),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("news_language_idx").on(t.language),
    index("news_category_idx").on(t.category),
  ],
);

// ─── Procurement — จัดซื้อจัดจ้าง ────────────────────────────────────────────

export const procurement = pgTable(
  "procurement",
  {
    id: serial("id").primaryKey(),
    language: text("language").notNull().default("th"),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    // ประกาศเชิญชวน / ประกาศราคากลาง / ประกาศผลผู้เสนอราคา /
    // ประกาศผลผู้ชนะ / ร่างTOR / ยกเลิก / แผนการจัดซื้อ / สขร.
    category: text("category").notNull().default(""),
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default([]),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("procurement_language_idx").on(t.language),
    index("procurement_category_idx").on(t.category),
  ],
);

// ─── Publications — เอกสารเผยแพร่ ────────────────────────────────────────────

export const publications = pgTable(
  "publications",
  {
    id: serial("id").primaryKey(),
    language: text("language").notNull().default("th"),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    // หลักธรรมาภิบาล / รายงานผล
    category: text("category").notNull().default(""),
    featuredImageId: integer("featured_image_id").references(() => media.id),
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default([]),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("publications_language_idx").on(t.language)],
);

// ─── Featured Projects — ผลงานและโครงการเด่น ─────────────────────────────────

export const featuredProjects = pgTable(
  "featured_projects",
  {
    id: serial("id").primaryKey(),
    language: text("language").notNull().default("th"),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    body: text("body").notNull().default(""),
    // วิจัย-นวัตกรรม / มาตรฐาน-ระบบทดสอบ / การถ่ายทอดเทคโนโลยี /
    // ฐานข้อมูลเทคโนโลยี / ยุทธศาสตร์-เทคโนโลยี / พัฒนา-บุคลากร
    category: text("category").notNull().default(""),
    featuredImageId: integer("featured_image_id").references(() => media.id),
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default([]),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("featured_projects_language_idx").on(t.language),
    index("featured_projects_category_idx").on(t.category),
  ],
);

// ─── Flipbooks — คลังความรู้ / interactive PDF publications ──────────────────

export const flipbooks = pgTable(
  "flipbooks",
  {
    id: serial("id").primaryKey(),
    language: text("language").notNull().default("th"),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    coverImageId: integer("cover_image_id").references(() => media.id),
    pdfPath: text("pdf_path"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("flipbooks_language_idx").on(t.language)],
);

// ─── Pages — static content pages (เกี่ยวกับ-สทร, ติดต่อเรา, etc.) ───────────

export const pages = pgTable(
  "pages",
  {
    id: serial("id").primaryKey(),
    language: text("language").notNull().default("th"),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    parentSlug: text("parent_slug"),
    featuredImageId: integer("featured_image_id").references(() => media.id),
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("pages_language_idx").on(t.language),
    index("pages_parent_slug_idx").on(t.parentSlug),
  ],
);

// ─── Jobs — สมัครงาน / ร่วมงานกับ สทร. ──────────────────────────────────────

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  language: text("language").notNull().default("th"),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  deadline: timestamp("deadline", { withTimezone: true }),
  attachments: jsonb("attachments").$type<Attachment[]>().notNull().default([]),
  isOpen: boolean("is_open").notNull().default(true),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── FAQ — ถาม-ตอบ ────────────────────────────────────────────────────────────

export const faq = pgTable("faq", {
  id: serial("id").primaryKey(),
  language: text("language").notNull().default("th"),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: text("category").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Events — calendar events (อบรม, สัมมนา, กิจกรรม) ───────────────────────

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    language: text("language").notNull().default("th"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    eventDate: date("event_date").notNull(),
    startTime: text("start_time"),
    endTime: text("end_time"),
    location: text("location").notNull().default(""),
    registrationUrl: text("registration_url").notNull().default(""),
    colorHex: text("color_hex").notNull().default("#0055c7"),
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("events_date_idx").on(t.eventDate)],
);

// ─── Partners — พันธมิตรทางยุทธศาสตร์ ────────────────────────────────────────

export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logoImageId: integer("logo_image_id").references(() => media.id),
  logoPath: text("logo_path"),
  websiteUrl: text("website_url").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─── Hero Slides — homepage banner slides ─────────────────────────────────────

export const heroSlides = pgTable("hero_slides", {
  id: serial("id").primaryKey(),
  language: text("language").notNull().default("th"),
  imageId: integer("image_id").references(() => media.id),
  imagePath: text("image_path"),
  altText: text("alt_text").notNull().default(""),
  linkUrl: text("link_url").notNull().default(""),
  caption: text("caption").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

// ─── Navigation — site nav tree ───────────────────────────────────────────────

export const navigation = pgTable(
  "navigation",
  {
    id: serial("id").primaryKey(),
    language: text("language").notNull(),
    label: text("label").notNull(),
    href: text("href").notNull(),
    path: text("path"),
    external: boolean("external").notNull().default(false),
    parentId: integer("parent_id"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("navigation_language_idx").on(t.language)],
);

// ─── Site Meta — key-value settings store ─────────────────────────────────────

export const siteMeta = pgTable("site_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
