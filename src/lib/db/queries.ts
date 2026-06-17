import type {
  WpContentRecord,
  WpDownloadAsset,
  WpLanguage,
  WpMediaAsset,
  WpNavigationItem,
  WpRouteKind,
} from "@/lib/wp/types";
import { normalizeRoutePath } from "@/lib/wp/url";
import { prisma } from "./client";

/** Shape returned by Prisma for ContentRecord rows. */
interface ContentRecordRow {
  id: string;
  wpId: string;
  language: string;
  kind: string;
  path: string;
  sourceUrl: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  searchText: string;
  date: string;
  modified: string;
  parentPath: string | null;
  categoryIds: number[];
  featuredMediaId: number | null;
  authorId: number | null;
}

function toRecord(row: ContentRecordRow): WpContentRecord {
  return {
    ...row,
    language: row.language as WpLanguage,
    kind: row.kind as WpRouteKind,
  };
}

function byTitle(language: WpLanguage) {
  return (a: WpContentRecord, b: WpContentRecord) =>
    a.title.localeCompare(b.title, language === "th" ? "th" : "en");
}

function lookupPath(path: string): string {
  return normalizeRoutePath(path).normalize("NFC");
}

export async function getRecordByPath(path: string): Promise<WpContentRecord | null> {
  const row = await prisma.contentRecord.findUnique({
    where: { path: lookupPath(path) },
  });
  return row ? toRecord(row) : null;
}

export async function recordExists(path: string): Promise<boolean> {
  const row = await prisma.contentRecord.findUnique({
    where: { path: lookupPath(path) },
    select: { id: true },
  });
  return row !== null;
}

/** Children of a page, title-sorted with Thai/English collation (as the UI shows them). */
export async function getChildren(
  parentPath: string,
  language: WpLanguage,
): Promise<WpContentRecord[]> {
  const rows = await prisma.contentRecord.findMany({
    where: { parentPath, language },
  });
  return rows.map(toRecord).sort(byTitle(language));
}

export async function getLatestPosts(
  language: WpLanguage,
  limit = 6,
): Promise<WpContentRecord[]> {
  const rows = await prisma.contentRecord.findMany({
    where: { language, kind: "post" },
    orderBy: { date: "desc" },
    take: limit,
  });
  return rows.map(toRecord);
}

// Stable WordPress term ids from the import: the home's two post lists.
export const CATEGORY_NEWS = 7; // ข่าวและกิจกรรม / News and Activities
export const CATEGORY_ARTICLES = 6; // บทความ / Recent Articles

export async function getPostsByCategory(
  categoryId: number,
  language: WpLanguage,
  limit = 6,
): Promise<WpContentRecord[]> {
  const rows = await prisma.contentRecord.findMany({
    where: { language, kind: "post", categoryIds: { has: categoryId } },
    orderBy: { date: "desc" },
    take: limit,
  });
  return rows.map(toRecord);
}

export async function countPostsByCategory(
  categoryId: number,
  language: WpLanguage,
): Promise<number> {
  return prisma.contentRecord.count({
    where: { language, kind: "post", categoryIds: { has: categoryId } },
  });
}

export interface CategoryInfo {
  id: number;
  slug: string;
  name: string;
}

export async function getCategoryBySlug(slug: string): Promise<CategoryInfo | null> {
  const row = await prisma.category.findFirst({ where: { slug } });
  if (!row) return null;
  return { id: row.id, slug: row.slug, name: row.name };
}

export interface CalendarDay {
  /** YYYY-MM-DD */
  day: string;
  /** Path of the most recent post that day; where the calendar cell links. */
  path: string;
  count: number;
}

/**
 * All days that have at least one post, for the interactive calendar. The
 * client highlights these days and links each to its most recent post.
 */
export async function getPostCalendar(language: WpLanguage): Promise<CalendarDay[]> {
  const rows = await prisma.contentRecord.findMany({
    where: { language, kind: "post" },
    select: { path: true, date: true },
    orderBy: { date: "desc" },
  });
  const byDay = new Map<string, CalendarDay>();
  for (const row of rows) {
    const day = row.date.slice(0, 10);
    const existing = byDay.get(day);
    if (existing) {
      existing.count += 1;
    } else {
      // rows are date-desc, so the first seen per day is the most recent.
      byDay.set(day, { day, path: row.path, count: 1 });
    }
  }
  return Array.from(byDay.values());
}

/** Top-level pages, used as footer quick links. */
export async function getTopLevelPages(language: WpLanguage): Promise<WpContentRecord[]> {
  const rows = await prisma.contentRecord.findMany({
    where: { language, kind: "page", parentPath: null },
  });
  return rows.map(toRecord).sort(byTitle(language));
}

export async function getNavigation(): Promise<Record<WpLanguage, WpNavigationItem[]>> {
  const row = await prisma.siteMeta.findUnique({ where: { key: "navigation" } });
  return (
    (row?.value as Record<WpLanguage, WpNavigationItem[]> | null) ?? { th: [], en: [] }
  );
}

export async function getGeneratedAt(): Promise<string> {
  const row = await prisma.siteMeta.findUnique({ where: { key: "generatedAt" } });
  return typeof row?.value === "string" ? row.value : "";
}

export async function getMediaByIds(ids: number[]): Promise<WpMediaAsset[]> {
  if (ids.length === 0) {
    return [];
  }
  return prisma.mediaAsset.findMany({
    where: { id: { in: ids.map((id) => String(id)) } },
  });
}

export async function getAllForSitemap(): Promise<
  Array<{ path: string; modified: string }>
> {
  return prisma.contentRecord.findMany({
    select: { path: true, modified: true },
    orderBy: { path: "asc" },
  });
}

export async function getDownloadById(id: string): Promise<WpDownloadAsset | null> {
  return prisma.download.findUnique({ where: { id } });
}

export async function getDownloadIds(): Promise<string[]> {
  const rows = await prisma.download.findMany({ select: { id: true } });
  return rows.map((row) => row.id);
}

export interface SiteStats {
  posts: number;
  pages: number;
  flipbooks: number;
  downloads: number;
}

export async function getStats(): Promise<SiteStats> {
  const [posts, pages, flipbooks, downloads] = await Promise.all([
    prisma.contentRecord.count({ where: { kind: "post" } }),
    prisma.contentRecord.count({ where: { kind: "page" } }),
    prisma.contentRecord.count({ where: { kind: "flipbook" } }),
    prisma.download.count(),
  ]);
  return { posts, pages, flipbooks, downloads };
}

/**
 * Site search. Rank 0: title/excerpt substring; rank 1: body substring;
 * rank 2: fuzzy (pg_trgm) title match. Trigram similarity works for Thai,
 * which has no word boundaries.
 */
export async function searchRecords(
  term: string,
  language: WpLanguage,
  limit = 80,
): Promise<WpContentRecord[]> {
  const trimmed = term.trim();
  if (trimmed === "") {
    return [];
  }
  const like = `%${trimmed}%`;
  const rows = await prisma.$queryRaw<ContentRecordRow[]>`
    SELECT "id", "wpId", "language", "kind", "path", "sourceUrl", "title",
           "excerpt", "contentHtml", "searchText", "date", "modified",
           "parentPath", "categoryIds", "featuredMediaId", "authorId"
    FROM "ContentRecord"
    WHERE "language" = ${language}
      AND ("title" ILIKE ${like}
        OR "excerpt" ILIKE ${like}
        OR "searchText" ILIKE ${like}
        OR similarity("title", ${trimmed}) > 0.25)
    ORDER BY
      CASE
        WHEN "title" ILIKE ${like} OR "excerpt" ILIKE ${like} THEN 0
        WHEN "searchText" ILIKE ${like} THEN 1
        ELSE 2
      END ASC,
      "date" DESC
    LIMIT ${limit}`;
  return rows.map(toRecord);
}
