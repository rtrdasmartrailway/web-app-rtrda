import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
} from "drizzle-orm/pg-core";

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
