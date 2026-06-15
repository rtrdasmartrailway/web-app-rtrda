import { cache } from "react";
import { and, asc, desc, eq, gte, ilike, isNull, lte, or } from "drizzle-orm";
import { db } from "./index";
import {
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
  downloads,
  user,
} from "./schema";
import type { ContentResource } from "@/lib/permissions";
import type { UserRole } from "@/lib/permissions";
import type { WpDownloadAsset, WpLanguage, WpNavigationItem } from "@/lib/wp/types";
import type { ContentView } from "@/lib/content/types";
import { CATEGORIES, getCategoryByPath, type CategoryDef } from "@/lib/content/categories";
import { splitLanguage, displayPath, pickLang } from "@/lib/content/i18n";
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

// ─── Content resolution (dedicated tables → ContentView) ──────────────────────
//
// Routable content lives across several dedicated tables. These helpers resolve a
// URL path to a ContentView and feed the catch-all route / page components.
// Nothing here reads wp_-prefixed tables.

type PageViewRow = {
  id: number;
  path: string;
  parentPath: string | null;
  titleTh: string;
  titleEn: string;
  bodyTh: string;
  bodyEn: string;
  updatedAt: Date | null;
  mediaPath: string | null;
};
type NewsViewRow = {
  id: number;
  slug: string;
  titleTh: string;
  titleEn: string;
  excerptTh: string;
  excerptEn: string;
  bodyTh: string;
  bodyEn: string;
  publishedAt: Date | null;
  mediaPath: string | null;
};

const pageSelect = {
  id: pages.id,
  path: pages.path,
  parentPath: pages.parentPath,
  titleTh: pages.titleTh,
  titleEn: pages.titleEn,
  bodyTh: pages.bodyTh,
  bodyEn: pages.bodyEn,
  updatedAt: pages.updatedAt,
  featuredImageId: pages.featuredImageId,
  mediaPath: media.filePath,
};

const newsSelect = {
  id: news.id,
  slug: news.slug,
  titleTh: news.titleTh,
  titleEn: news.titleEn,
  excerptTh: news.excerptTh,
  excerptEn: news.excerptEn,
  bodyTh: news.bodyTh,
  bodyEn: news.bodyEn,
  publishedAt: news.publishedAt,
  featuredImageId: news.featuredImageId,
  mediaPath: media.filePath,
};

// Mappers take the request `language`; the row stores the canonical (Thai) path
// and both languages, so we localize and build the language-specific path here.
function pageToView(row: PageViewRow, language: WpLanguage): ContentView {
  return {
    id: `page-${row.id}`,
    language,
    kind: "page",
    path: displayPath(row.path, language),
    parentPath: row.parentPath ? displayPath(row.parentPath, language) : null,
    title: pickLang(row.titleTh, row.titleEn, language),
    excerpt: "",
    body: pickLang(row.bodyTh, row.bodyEn, language),
    date: row.updatedAt?.toISOString() ?? "",
    featuredImagePath: row.mediaPath ?? null,
    sourceUrl: "",
  };
}

function newsToView(row: NewsViewRow, language: WpLanguage): ContentView {
  const canonical = `/${row.slug}`;
  const parentCanonical = canonical.split("/").slice(0, -1).join("/") || null;
  return {
    id: `news-${row.id}`,
    language,
    kind: "post",
    path: displayPath(canonical, language),
    parentPath: parentCanonical ? displayPath(parentCanonical, language) : null,
    title: pickLang(row.titleTh, row.titleEn, language),
    excerpt: pickLang(row.excerptTh, row.excerptEn, language),
    body: pickLang(row.bodyTh, row.bodyEn, language),
    date: row.publishedAt?.toISOString() ?? "",
    featuredImagePath: row.mediaPath ?? null,
    sourceUrl: "",
  };
}

function flipbookToView(row: typeof flipbooks.$inferSelect): ContentView {
  return {
    id: `flipbook-${row.id}`,
    language: row.language as WpLanguage,
    kind: "flipbook",
    path: row.path ?? `/3d-flip-book/${row.slug}`,
    parentPath: null,
    title: row.title,
    excerpt: row.description,
    body: row.description,
    date: row.publishedAt?.toISOString() ?? "",
    featuredImagePath: null,
    // pdfPath stores the upstream document URL — FlipbookPage opens it.
    sourceUrl: row.pdfPath ?? "",
  };
}

function categoryToView(cat: CategoryDef): ContentView {
  return {
    id: `category-${cat.path}`,
    language: cat.language,
    kind: "category",
    path: cat.path,
    parentPath: null,
    title: cat.title,
    excerpt: "",
    body: "",
    date: "",
    featuredImagePath: null,
    sourceUrl: "",
  };
}

export const getContentByPath = cache(async (rawPath: string): Promise<ContentView | null> => {
  const fullPath = normalizeRoutePath(rawPath);
  if (!db) return MOCK_RECORDS.find((r) => r.path === fullPath) ?? null;

  // Bilingual tables (pages, news) are keyed by the canonical Thai path; the
  // /en prefix selects the English columns.
  const { language, canonical } = splitLanguage(fullPath);

  // 1. pages (takes precedence over posts on path collisions)
  const pageRows = await db
    .select(pageSelect)
    .from(pages)
    .leftJoin(media, eq(pages.featuredImageId, media.id))
    .where(eq(pages.path, canonical))
    .limit(1);
  if (pageRows[0]) return pageToView(pageRows[0], language);

  // 2. posts — news.slug is the canonical path without its leading slash
  const newsRows = await db
    .select(newsSelect)
    .from(news)
    .leftJoin(media, eq(news.featuredImageId, media.id))
    .where(eq(news.slug, canonical.slice(1)))
    .limit(1);
  if (newsRows[0]) return newsToView(newsRows[0], language);

  // 3. flipbooks (still per-language rows, keyed by full path)
  const fbRows = await db.select().from(flipbooks).where(eq(flipbooks.path, fullPath)).limit(1);
  if (fbRows[0]) return flipbookToView(fbRows[0]);

  // 4. category landing pages (static config, per-language paths)
  const cat = getCategoryByPath(fullPath);
  if (cat) return categoryToView(cat);

  return null;
});

export async function getAllContentPaths(): Promise<{ path: string }[]> {
  if (!db) return MOCK_RECORDS.map((r) => ({ path: r.path }));
  const [pageRows, newsRows, fbRows] = await Promise.all([
    db.select({ path: pages.path }).from(pages),
    db.select({ slug: news.slug }).from(news),
    db.select({ path: flipbooks.path }).from(flipbooks),
  ]);
  return [
    // Each bilingual row yields both a Thai and an English URL.
    ...pageRows.flatMap((r) => [{ path: r.path }, { path: displayPath(r.path, "en") }]),
    ...newsRows.flatMap((r) => [{ path: `/${r.slug}` }, { path: `/en/${r.slug}` }]),
    ...fbRows.filter((r): r is { path: string } => Boolean(r.path)).map((r) => ({ path: r.path })),
    ...CATEGORIES.map((c) => ({ path: c.path })),
  ];
}

export async function getChildPages(parentPath: string): Promise<ContentView[]> {
  if (!db) return MOCK_RECORDS.filter((r) => r.parentPath === parentPath);
  const { language, canonical } = splitLanguage(parentPath);
  const rows = await db
    .select(pageSelect)
    .from(pages)
    .leftJoin(media, eq(pages.featuredImageId, media.id))
    .where(eq(pages.parentPath, canonical))
    .orderBy(asc(pages.sortOrder), asc(pages.titleTh));
  return rows.map((r) => pageToView(r, language));
}

export async function getLatestPosts(language: WpLanguage, limit = 6): Promise<ContentView[]> {
  if (!db) {
    return MOCK_RECORDS.filter((r) => r.kind === "post" && r.language === language).slice(0, limit);
  }
  const rows = await db
    .select(newsSelect)
    .from(news)
    .leftJoin(media, eq(news.featuredImageId, media.id))
    .orderBy(desc(news.publishedAt))
    .limit(limit);
  return rows.map((r) => newsToView(r, language));
}

export async function getTopLevelPages(language: WpLanguage): Promise<ContentView[]> {
  if (!db) {
    return MOCK_RECORDS.filter((r) => r.kind === "page" && r.parentPath === null && r.language === language);
  }
  const rows = await db
    .select(pageSelect)
    .from(pages)
    .leftJoin(media, eq(pages.featuredImageId, media.id))
    .where(isNull(pages.parentPath))
    .orderBy(asc(pages.sortOrder), asc(pages.titleTh));
  return rows.map((r) => pageToView(r, language));
}

export async function getNavItems(language: WpLanguage): Promise<WpNavigationItem[]> {
  if (!db) return language === "en" ? MOCK_NAV_EN : MOCK_NAV;
  const rows = await db
    .select()
    .from(navigation)
    .where(eq(navigation.language, language))
    .orderBy(asc(navigation.sortOrder));

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

export async function searchContent(query: string, limit = 80): Promise<ContentView[]> {
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
  const [pageRows, newsRows] = await Promise.all([
    db
      .select(pageSelect)
      .from(pages)
      .leftJoin(media, eq(pages.featuredImageId, media.id))
      .where(or(
        ilike(pages.titleTh, term), ilike(pages.titleEn, term),
        ilike(pages.bodyTh, term), ilike(pages.bodyEn, term),
      ))
      .limit(limit),
    db
      .select(newsSelect)
      .from(news)
      .leftJoin(media, eq(news.featuredImageId, media.id))
      .where(or(
        ilike(news.titleTh, term), ilike(news.titleEn, term),
        ilike(news.excerptTh, term), ilike(news.excerptEn, term),
        ilike(news.bodyTh, term), ilike(news.bodyEn, term),
      ))
      .limit(limit),
  ]);
  // Search spans both languages; render matches in Thai (the /search page is th).
  return [
    ...pageRows.map((r) => pageToView(r, "th")),
    ...newsRows.map((r) => newsToView(r, "th")),
  ].slice(0, limit);
}

function downloadRowToAsset(row: typeof downloads.$inferSelect): WpDownloadAsset {
  return {
    id: row.id,
    sourceUrl: row.sourceUrl,
    localPath: row.localPath,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    title: row.title,
    group: row.groupName,
    sourcePages: row.sourcePages ?? [],
  };
}

export async function getDownloadById(id: string): Promise<WpDownloadAsset | null> {
  if (!db) return MOCK_DOWNLOADS.find((d) => d.id === id) ?? null;
  const rows = await db.select().from(downloads).where(eq(downloads.id, id)).limit(1);
  return rows[0] ? downloadRowToAsset(rows[0]) : null;
}

export async function getAllDownloads(group?: string): Promise<WpDownloadAsset[]> {
  if (!db) {
    return group ? MOCK_DOWNLOADS.filter((d) => d.group === group) : MOCK_DOWNLOADS;
  }
  const rows = await db.select().from(downloads).orderBy(asc(downloads.title));
  const filtered = group ? rows.filter((r) => r.groupName === group) : rows;
  return filtered.map(downloadRowToAsset);
}

export async function listContent(opts: {
  language?: WpLanguage;
  kind?: string;
  limit?: number;
  offset?: number;
}): Promise<ContentView[]> {
  const { language = "th", kind, limit = 50, offset = 0 } = opts;
  if (!db) {
    return MOCK_RECORDS.filter(
      (r) => r.language === language && (!kind || r.kind === kind)
    ).slice(offset, offset + limit);
  }
  const [pageRows, newsRows] = await Promise.all([
    db
      .select(pageSelect)
      .from(pages)
      .leftJoin(media, eq(pages.featuredImageId, media.id)),
    db
      .select(newsSelect)
      .from(news)
      .leftJoin(media, eq(news.featuredImageId, media.id)),
  ]);
  const all = [
    ...pageRows.map((r) => pageToView(r, language)),
    ...newsRows.map((r) => newsToView(r, language)),
  ].filter((r) => !kind || r.kind === kind);
  return all.slice(offset, offset + limit);
}

export async function getGeneratedAt(): Promise<string> {
  if (!db) return new Date().toISOString();
  return (await getSiteMeta("generatedAt")) ?? "";
}

// ─── News ─────────────────────────────────────────────────────────────────────

export async function listNews(opts: {
  category?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<NewsRow[]> {
  const { category, limit = 20, offset = 0 } = opts;
  if (!db) return [];
  return db
    .select()
    .from(news)
    .where(category ? eq(news.category, category) : undefined)
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
  category?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<FeaturedProjectRow[]> {
  const { category, limit = 20, offset = 0 } = opts;
  if (!db) return [];
  return db
    .select()
    .from(featuredProjects)
    .where(category ? eq(featuredProjects.category, category) : undefined)
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
  parentSlug?: string | null;
  limit?: number;
} = {}): Promise<PageRow[]> {
  const { parentSlug, limit = 100 } = opts;
  if (!db) return [];
  return db
    .select()
    .from(pages)
    .where(
      parentSlug === null
        ? isNull(pages.parentSlug)
        : parentSlug
          ? eq(pages.parentSlug, parentSlug)
          : undefined,
    )
    .orderBy(asc(pages.sortOrder), asc(pages.titleTh))
    .limit(Math.min(limit, 500));
}

export const getPageByPath = cache(async (path: string): Promise<PageRow | null> => {
  if (!db) return null;
  const { canonical } = splitLanguage(path);
  const rows = await db.select().from(pages).where(eq(pages.path, canonical)).limit(1);
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

// ─── Content write helpers (intranet CMS) ─────────────────────────────────────
//
// Generic create/update/delete/read used by the admin server actions for all
// four manageable content resources. Drizzle tables are resolved from a single
// map so one implementation serves every resource. Values are validated by zod
// (see src/lib/content-config.ts) before reaching these functions.

const CONTENT_TABLES = {
  news,
  procurement,
  publications,
  featuredProjects,
} as const;

type ContentTable = (typeof CONTENT_TABLES)[ContentResource];
export type ContentRow = ContentTable["$inferSelect"];
export type ContentInsert = ContentTable["$inferInsert"];

function tableFor(resource: ContentResource) {
  return CONTENT_TABLES[resource];
}

class DbUnavailableError extends Error {
  constructor() {
    super("Database is not configured (DATABASE_URL missing).");
    this.name = "DbUnavailableError";
  }
}

export async function listContentForAdmin(
  resource: ContentResource,
  opts: { limit?: number; offset?: number } = {},
): Promise<ContentRow[]> {
  if (!db) return [];
  const { limit = 100, offset = 0 } = opts;
  const table = tableFor(resource);
  // No publishedAt filter — admins must see drafts/unpublished items too.
  return db
    .select()
    .from(table)
    .orderBy(desc(table.updatedAt))
    .limit(Math.min(limit, 500))
    .offset(offset) as Promise<ContentRow[]>;
}

export async function getContentById(
  resource: ContentResource,
  id: number,
): Promise<ContentRow | null> {
  if (!db) return null;
  const table = tableFor(resource);
  const rows = await db.select().from(table).where(eq(table.id, id)).limit(1);
  return (rows[0] as ContentRow) ?? null;
}

export async function insertContent(
  resource: ContentResource,
  values: Record<string, unknown>,
): Promise<ContentRow> {
  if (!db) throw new DbUnavailableError();
  const table = tableFor(resource);
  const rows = await db
    .insert(table)
    .values(values as ContentInsert)
    .returning();
  return rows[0] as ContentRow;
}

export async function updateContent(
  resource: ContentResource,
  id: number,
  values: Record<string, unknown>,
): Promise<ContentRow | null> {
  if (!db) throw new DbUnavailableError();
  const table = tableFor(resource);
  const rows = await db
    .update(table)
    .set({ ...values, updatedAt: new Date() } as Partial<ContentInsert>)
    .where(eq(table.id, id))
    .returning();
  return (rows[0] as ContentRow) ?? null;
}

export async function deleteContent(
  resource: ContentResource,
  id: number,
): Promise<void> {
  if (!db) throw new DbUnavailableError();
  const table = tableFor(resource);
  await db.delete(table).where(eq(table.id, id));
}

// ─── Media write helper ───────────────────────────────────────────────────────

export async function insertMedia(values: {
  filename: string;
  filePath: string;
  mimeType?: string;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  altText?: string;
}): Promise<MediaRow> {
  if (!db) throw new DbUnavailableError();
  const rows = await db.insert(media).values(values).returning();
  return rows[0];
}

// ─── User / role administration ───────────────────────────────────────────────

export type UserRow = typeof user.$inferSelect;

export async function listUsers(): Promise<UserRow[]> {
  if (!db) return [];
  return db.select().from(user).orderBy(asc(user.email));
}

export async function countAdmins(): Promise<number> {
  if (!db) return 0;
  const rows = await db.select({ id: user.id }).from(user).where(eq(user.role, "admin"));
  return rows.length;
}

export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  if (!db) throw new DbUnavailableError();
  await db
    .update(user)
    .set({ role, updatedAt: new Date() })
    .where(eq(user.id, userId));
}
