import type { WpLanguage } from "@/lib/wp/types";

/** The kinds of routable content the catch-all route can render. */
export type ContentKind = "page" | "post" | "flipbook" | "category" | "fallback";

/**
 * Neutral view-model the front-end consumes, decoupled from any specific table.
 * The query layer maps dedicated-table rows (pages / news / flipbooks / …) into
 * this shape so page components never touch raw Drizzle rows or wp_ tables.
 */
export interface ContentView {
  id: string;
  language: WpLanguage;
  kind: ContentKind;
  /** Full URL path, e.g. /เกี่ยวกับ-สทร/วิสัยทัศน์ */
  path: string;
  parentPath: string | null;
  title: string;
  excerpt: string;
  /** Plain-text/HTML body (was contentHtml on the old wp_content record). */
  body: string;
  /** ISO date string. */
  date: string;
  /** Resolved web path to the featured image, or null to use a fallback asset. */
  featuredImagePath: string | null;
  /** Original source URL — used by flipbooks to open the upstream document. */
  sourceUrl: string;
}
