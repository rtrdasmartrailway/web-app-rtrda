import { cache } from "react";
import { and, asc, desc, eq, gte, ilike, isNull, lte, or } from "drizzle-orm";
import { db } from "./index";
import {
  wpContent,
  wpDownloads,
  wpMeta,
  wpNavigation,
  news,
  procurement,
  publications,
  featuredProjects,
  flipbooks,
  pages,
  jobs,
  faq,
  events,
  partners,
  heroSlides,
  navigation,
  media,
  siteMeta,
} from "./schema";
import type { WpContentRecord, WpDownloadAsset, WpLanguage, WpNavigationItem } from "@/lib/wp/types";
import { normalizeRoutePath } from "@/lib/wp/url";
import { MOCK_RECORDS, MOCK_DOWNLOADS, MOCK_NAV, MOCK_NAV_EN } from "./mock";

// ─── Exported row types (for new tables) ─────────────────────────────────────

export type NewsRow = typeof news.$inferSelect;
export type ProcurementRow = typeof procurement.$inferSelect;
export type PublicationRow = typeof publications.$inferSelect;
export type FeaturedProjectRow = typeof featuredProjects.$inferSelect;
export type FlipbookRow = typeof flipbooks.$inferSelect;
export type PageRow = typeof pages.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
export type FaqRow = typeof faq.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type PartnerRow = typeof partners.$inferSelect;
export type HeroSlideRow = typeof heroSlides.$inferSelect;
export type NavigationRow = typeof navigation.$inferSelect;
export type MediaRow = typeof media.$inferSelect;

// ─── Legacy wp_content queries (unchanged) ────────────────────────────────────

function rowToRecord(row: typeof wpContent.$inferSelect): WpContentRecord {
  return {
    id: String(row.wpId),
    wpId: row.wpId,
    language: row.language as WpLanguage,
    kind: row.kind as WpContentRecord["kind"],
    path: row.path,
    sourceUrl: row.sourceUrl,
    title: row.title,
    excerpt: row.excerpt,
    contentHtml: row.contentHtml,
    modified: row.modified,
    date: row.date,
    parentPath: row.parentPath ?? null,
    categoryIds: [],
    featuredMediaId: row.featuredMediaId ?? null,
    featuredMediaPath: row.featuredMediaPath ?? null,
  };
}

export const getContentByPath = cache(async (path: string): Promise<WpContentRecord | null> => {
  const normalized = normalizeRoutePath(path);
  if (!db) return MOCK_RECORDS.find((r) => r.path === normalized) ?? null;
  const rows = await db
    .select()
    .from(wpContent)
    .where(eq(wpContent.path, normalized))
    .limit(1);
  return rows[0] ? rowToRecord(rows[0]) : null;
});

export async function getAllContentPaths(): Promise<{ path: string }[]> {
  if (!db) return MOCK_RECORDS.map((r) => ({ path: r.path }));
  return db.select({ path: wpContent.path }).from(wpContent);
}

export async function getChildPages(parentPath: string): Promise<WpContentRecord[]> {
  if (!db) return MOCK_RECORDS.filter((r) => r.parentPath === parentPath);
  const rows = await db
    .select()
    .from(wpContent)
    .where(eq(wpContent.parentPath, parentPath))
    .orderBy(asc(wpContent.title));
  return rows.map(rowToRecord);
}

export async function getSiblingPages(parentPath: string): Promise<WpContentRecord[]> {
  return getChildPages(parentPath);
}

export async function getLatestPosts(language: WpLanguage, limit = 6): Promise<WpContentRecord[]> {
  if (!db) {
    return MOCK_RECORDS.filter((r) => r.kind === "post" && r.language === language).slice(0, limit);
  }
  const rows = await db
    .select()
    .from(wpContent)
    .where(eq(wpContent.language, language))
    .orderBy(desc(wpContent.date))
    .limit(limit);
  return rows.filter((r) => r.kind === "post").map(rowToRecord);
}

export async function getTopLevelPages(language: WpLanguage): Promise<WpContentRecord[]> {
  if (!db) {
    return MOCK_RECORDS.filter((r) => r.kind === "page" && r.parentPath === null && r.language === language);
  }
  const rows = await db
    .select()
    .from(wpContent)
    .where(eq(wpContent.language, language))
    .orderBy(asc(wpContent.title));
  return rows
    .filter((r) => r.kind === "page" && r.parentPath === null)
    .map(rowToRecord);
}

export async function getNavItems(language: WpLanguage): Promise<WpNavigationItem[]> {
  if (!db) return language === "en" ? MOCK_NAV_EN : MOCK_NAV;
  const rows = await db
    .select()
    .from(wpNavigation)
    .where(eq(wpNavigation.language, language))
    .orderBy(asc(wpNavigation.sortOrder));

  const topLevel = rows.filter((r) => r.parentId === null);
  return topLevel.map((item) => ({
    label: item.label,
    href: item.href,
    path: item.path ?? null,
    external: item.external,
    children: rows
      .filter((r) => r.parentId === item.sortOrder && r.language === language)
      .map((child) => ({
        label: child.label,
        href: child.href,
        path: child.path ?? null,
        external: child.external,
        children: [],
      })),
  }));
}

export async function searchContent(query: string, limit = 80): Promise<WpContentRecord[]> {
  if (!db) {
    const q = query.toLowerCase();
    return MOCK_RECORDS.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.excerpt.toLowerCase().includes(q) ||
        r.path.toLowerCase().includes(q)
    ).slice(0, limit);
  }
  const term = `%${query}%`;
  const rows = await db
    .select()
    .from(wpContent)
    .where(or(ilike(wpContent.title, term), ilike(wpContent.excerpt, term), ilike(wpContent.path, term)))
    .limit(limit);
  return rows.map(rowToRecord);
}

export async function getDownloadById(id: string): Promise<WpDownloadAsset | null> {
  if (!db) return MOCK_DOWNLOADS.find((d) => d.id === id) ?? null;
  const rows = await db
    .select()
    .from(wpDownloads)
    .where(eq(wpDownloads.id, id))
    .limit(1);
  if (!rows[0]) return null;
  const row = rows[0];
  return {
    id: row.id,
    sourceUrl: row.sourceUrl,
    localPath: row.localPath,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    title: row.title,
    group: row.group,
    sourcePages: [],
  };
}

export async function getAllDownloads(group?: string): Promise<WpDownloadAsset[]> {
  if (!db) {
    return group ? MOCK_DOWNLOADS.filter((d) => d.group === group) : MOCK_DOWNLOADS;
  }
  const rows = await db.select().from(wpDownloads).orderBy(asc(wpDownloads.title));
  const filtered = group ? rows.filter((r) => r.group === group) : rows;
  return filtered.map((row) => ({
    id: row.id,
    sourceUrl: row.sourceUrl,
    localPath: row.localPath,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    title: row.title,
    group: row.group,
    sourcePages: [],
  }));
}

export async function listContent(opts: {
  language?: WpLanguage;
  kind?: string;
  limit?: number;
  offset?: number;
}): Promise<WpContentRecord[]> {
  const { language, kind, limit = 50, offset = 0 } = opts;
  if (!db) {
    return MOCK_RECORDS.filter(
      (r) => (!language || r.language === language) && (!kind || r.kind === kind)
    ).slice(offset, offset + limit);
  }
  const rows = await db
    .select()
    .from(wpContent)
    .orderBy(desc(wpContent.date))
    .limit(Math.min(limit, 200))
    .offset(offset);
  return rows
    .filter((r) => (!language || r.language === language) && (!kind || r.kind === kind))
    .map(rowToRecord);
}

export async function getGeneratedAt(): Promise<string> {
  if (!db) return new Date().toISOString();
  const rows = await db
    .select()
    .from(wpMeta)
    .where(eq(wpMeta.key, "generatedAt"))
    .limit(1);
  return rows[0]?.value ?? "";
}

// ─── News ─────────────────────────────────────────────────────────────────────

export async function listNews(opts: {
  language?: string;
  category?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<NewsRow[]> {
  const { language, category, limit = 20, offset = 0 } = opts;
  if (!db) return [];
  return db
    .select()
    .from(news)
    .where(and(
      language ? eq(news.language, language) : undefined,
      category ? eq(news.category, category) : undefined,
    ))
    .orderBy(desc(news.publishedAt))
    .limit(Math.min(limit, 200))
    .offset(offset);
}

export const getNewsBySlug = cache(async (slug: string): Promise<NewsRow | null> => {
  if (!db) return null;
  const rows = await db.select().from(news).where(eq(news.slug, slug)).limit(1);
  return rows[0] ?? null;
});

// ─── Procurement ─────────────────────────────────────────────────────────────

export async function listProcurement(opts: {
  language?: string;
  category?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<ProcurementRow[]> {
  const { language, category, limit = 20, offset = 0 } = opts;
  if (!db) return [];
  return db
    .select()
    .from(procurement)
    .where(and(
      language ? eq(procurement.language, language) : undefined,
      category ? eq(procurement.category, category) : undefined,
    ))
    .orderBy(desc(procurement.publishedAt))
    .limit(Math.min(limit, 200))
    .offset(offset);
}

export const getProcurementBySlug = cache(async (slug: string): Promise<ProcurementRow | null> => {
  if (!db) return null;
  const rows = await db.select().from(procurement).where(eq(procurement.slug, slug)).limit(1);
  return rows[0] ?? null;
});

// ─── Publications ─────────────────────────────────────────────────────────────

export async function listPublications(opts: {
  language?: string;
  category?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<PublicationRow[]> {
  const { language, category, limit = 20, offset = 0 } = opts;
  if (!db) return [];
  return db
    .select()
    .from(publications)
    .where(and(
      language ? eq(publications.language, language) : undefined,
      category ? eq(publications.category, category) : undefined,
    ))
    .orderBy(desc(publications.publishedAt))
    .limit(Math.min(limit, 200))
    .offset(offset);
}

export const getPublicationBySlug = cache(async (slug: string): Promise<PublicationRow | null> => {
  if (!db) return null;
  const rows = await db.select().from(publications).where(eq(publications.slug, slug)).limit(1);
  return rows[0] ?? null;
});

// ─── Featured Projects ────────────────────────────────────────────────────────

export async function listFeaturedProjects(opts: {
  language?: string;
  category?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<FeaturedProjectRow[]> {
  const { language, category, limit = 20, offset = 0 } = opts;
  if (!db) return [];
  return db
    .select()
    .from(featuredProjects)
    .where(and(
      language ? eq(featuredProjects.language, language) : undefined,
      category ? eq(featuredProjects.category, category) : undefined,
    ))
    .orderBy(desc(featuredProjects.publishedAt))
    .limit(Math.min(limit, 200))
    .offset(offset);
}

export const getFeaturedProjectBySlug = cache(async (slug: string): Promise<FeaturedProjectRow | null> => {
  if (!db) return null;
  const rows = await db.select().from(featuredProjects).where(eq(featuredProjects.slug, slug)).limit(1);
  return rows[0] ?? null;
});

// ─── Flipbooks ────────────────────────────────────────────────────────────────

export async function listFlipbooks(opts: {
  language?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<FlipbookRow[]> {
  const { language, limit = 20, offset = 0 } = opts;
  if (!db) return [];
  return db
    .select()
    .from(flipbooks)
    .where(language ? eq(flipbooks.language, language) : undefined)
    .orderBy(desc(flipbooks.publishedAt))
    .limit(Math.min(limit, 200))
    .offset(offset);
}

export const getFlipbookBySlug = cache(async (slug: string): Promise<FlipbookRow | null> => {
  if (!db) return null;
  const rows = await db.select().from(flipbooks).where(eq(flipbooks.slug, slug)).limit(1);
  return rows[0] ?? null;
});

// ─── Pages ────────────────────────────────────────────────────────────────────

export async function listPages(opts: {
  language?: string;
  parentSlug?: string | null;
  limit?: number;
} = {}): Promise<PageRow[]> {
  const { language, parentSlug, limit = 100 } = opts;
  if (!db) return [];
  return db
    .select()
    .from(pages)
    .where(and(
      language ? eq(pages.language, language) : undefined,
      parentSlug === null
        ? isNull(pages.parentSlug)
        : parentSlug
          ? eq(pages.parentSlug, parentSlug)
          : undefined,
    ))
    .orderBy(asc(pages.sortOrder), asc(pages.title))
    .limit(Math.min(limit, 500));
}

export const getPageBySlug = cache(async (slug: string): Promise<PageRow | null> => {
  if (!db) return null;
  const rows = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1);
  return rows[0] ?? null;
});

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export async function listJobs(opts: {
  language?: string;
  isOpen?: boolean;
  limit?: number;
  offset?: number;
} = {}): Promise<JobRow[]> {
  const { language, isOpen, limit = 20, offset = 0 } = opts;
  if (!db) return [];
  return db
    .select()
    .from(jobs)
    .where(and(
      language ? eq(jobs.language, language) : undefined,
      isOpen !== undefined ? eq(jobs.isOpen, isOpen) : undefined,
    ))
    .orderBy(desc(jobs.publishedAt))
    .limit(Math.min(limit, 200))
    .offset(offset);
}

export const getJobBySlug = cache(async (slug: string): Promise<JobRow | null> => {
  if (!db) return null;
  const rows = await db.select().from(jobs).where(eq(jobs.slug, slug)).limit(1);
  return rows[0] ?? null;
});

// ─── FAQ ──────────────────────────────────────────────────────────────────────

export async function listFaq(opts: {
  language?: string;
  category?: string;
} = {}): Promise<FaqRow[]> {
  const { language, category } = opts;
  if (!db) return [];
  return db
    .select()
    .from(faq)
    .where(and(
      language ? eq(faq.language, language) : undefined,
      category ? eq(faq.category, category) : undefined,
    ))
    .orderBy(asc(faq.sortOrder));
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function listEvents(opts: {
  language?: string;
  from?: string;
  to?: string;
  limit?: number;
} = {}): Promise<EventRow[]> {
  const { language, from, to, limit = 50 } = opts;
  if (!db) return [];
  return db
    .select()
    .from(events)
    .where(and(
      language ? eq(events.language, language) : undefined,
      from ? gte(events.eventDate, from) : undefined,
      to ? lte(events.eventDate, to) : undefined,
    ))
    .orderBy(asc(events.eventDate))
    .limit(Math.min(limit, 200));
}

// ─── Partners ─────────────────────────────────────────────────────────────────

export async function listPartners(): Promise<PartnerRow[]> {
  if (!db) return [];
  return db.select().from(partners).orderBy(asc(partners.sortOrder));
}

// ─── Hero Slides ──────────────────────────────────────────────────────────────

export async function listHeroSlides(opts: {
  language?: string;
  activeOnly?: boolean;
} = {}): Promise<HeroSlideRow[]> {
  const { language, activeOnly = true } = opts;
  if (!db) return [];
  return db
    .select()
    .from(heroSlides)
    .where(and(
      language ? eq(heroSlides.language, language) : undefined,
      activeOnly ? eq(heroSlides.isActive, true) : undefined,
    ))
    .orderBy(asc(heroSlides.sortOrder));
}

// ─── Navigation (new table) ───────────────────────────────────────────────────

export async function getNavigationItems(language: string): Promise<NavigationRow[]> {
  if (!db) return [];
  return db
    .select()
    .from(navigation)
    .where(eq(navigation.language, language))
    .orderBy(asc(navigation.sortOrder));
}

// ─── Media ────────────────────────────────────────────────────────────────────

export const getMediaById = cache(async (id: number): Promise<MediaRow | null> => {
  if (!db) return null;
  const rows = await db.select().from(media).where(eq(media.id, id)).limit(1);
  return rows[0] ?? null;
});

// ─── Site Meta ────────────────────────────────────────────────────────────────

export async function getSiteMeta(key: string): Promise<string | null> {
  if (!db) return null;
  const rows = await db.select().from(siteMeta).where(eq(siteMeta.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function setSiteMeta(key: string, value: string): Promise<void> {
  if (!db) return;
  await db
    .insert(siteMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: siteMeta.key, set: { value } });
}
