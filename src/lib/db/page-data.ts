import { cache } from "react";
import type {
  WpContentRecord,
  WpLanguage,
  WpMediaAsset,
  WpNavigationItem,
} from "@/lib/wp/types";
import {
  buildPrimaryNavigation,
  resolveCardImagePath,
  type PresentationNavItem,
  type PresentationSidebarItem,
} from "@/lib/wp/presentation";
import {
  buildPdfReaderTargets,
  extractIframePdfSource,
  type PdfReaderTarget,
} from "@/lib/wp/pdf-reader";
import {
  buildKnowledgeDocumentGroups,
  isKnowledgeDocumentPath,
  type KnowledgeDocumentGroup,
} from "@/lib/wp/knowledge-documents";
import {
  buildBoardExecutivePresentation,
  type BoardExecutivePresentation,
} from "@/lib/wp/board-executives";
import { applyContactMapOverride } from "@/lib/wp/contact-map";
import { normalizeRoutePath } from "@/lib/wp/url";
import { extractPartnerLogos } from "@/lib/wp/home";
import {
  CATEGORY_ARTICLES,
  CATEGORY_NEWS,
  countPostsByCategory,
  getCategoryBySlug,
  getChildren,
  getGeneratedAt,
  getDownloadById,
  getDownloadIds,
  getLatestPosts,
  getMediaByIds,
  getNavigation,
  getPostCalendar,
  getPostsByCategory,
  getRecordByPath,
  getTopLevelPages,
  recordExists,
  type CalendarDay,
} from "./queries";

export interface Card {
  record: WpContentRecord;
  imagePath: string;
}

export interface HomeData {
  news: Card[];
  articles: Card[];
  partners: string[];
  calendarDays: CalendarDay[];
}

export interface ShellData {
  language: WpLanguage;
  path: string;
  alternatePath: string;
  navItems: PresentationNavItem[];
  footerNav: WpNavigationItem[];
  generatedAt: string;
}

export interface CategoryPagination {
  /** 1-based current page. */
  currentPage: number;
  /** Total number of pages. */
  totalPages: number;
  /** Total posts in this category (across all pages). */
  totalPosts: number;
  /** Posts per page. */
  pageSize: number;
  /** Base path of the category (no /page/N suffix). */
  basePath: string;
}

export interface PageData {
  record: WpContentRecord;
  children: Card[];
  latest: Card[];
  /** News items extracted from a category listing's <ul class="wp-import-list">. */
  newsCards: Card[];
  /** Pagination state for category listing pages; null on non-category pages. */
  categoryPagination: CategoryPagination | null;
  /** Custom home-page sections; null for non-home pages. */
  home: HomeData | null;
  /** Normalized document groups for the knowledge-base pages only. */
  knowledgeDocuments: KnowledgeDocumentGroup[] | null;
  /** Normalized org chart for the board/executive page only. */
  boardExecutivePresentation: BoardExecutivePresentation | null;
  pdfReaderTargets: PdfReaderTarget[];
  sidebarItems: PresentationSidebarItem[];
  parentTitle: string;
  shell: ShellData;
}

export function currentLanguage(path: string): WpLanguage {
  return path === "/en" || path.startsWith("/en/") ? "en" : "th";
}

/** The path the language switcher should try for the other language. */
export function deriveCounterpartCandidate(path: string, language: WpLanguage): string {
  if (language === "th") {
    return path === "/" ? "/en" : `/en${path}`;
  }
  return path === "/en" ? "/" : path.replace(/^\/en/, "") || "/";
}

/** Sidebar shows the page's children, else its siblings (legacy behavior). */
export function buildSidebarItems(
  record: WpContentRecord,
  children: WpContentRecord[],
  siblings: WpContentRecord[],
): PresentationSidebarItem[] {
  const source = children.length > 0 ? children : record.parentPath ? siblings : [];
  // Filter out the current page itself (a "siblings = [self]" result is useless
  // for navigation). When everything is filtered out, return [] so the layout
  // collapses sidebar and gives content-main the full width.
  const selfPath = normalizeRoutePath(record.path);
  const filtered = source.filter((item) => normalizeRoutePath(item.path) !== selfPath);
  return filtered.map((item) => ({
    label: item.title,
    path: item.path,
    active: normalizeRoutePath(item.path) === selfPath,
  }));
}

export function toCards(records: WpContentRecord[], media: WpMediaAsset[]): Card[] {
  return records.map((record) => ({
    record,
    imagePath: resolveCardImagePath(record, media),
  }));
}

function hasImportedLatestPosts(record: WpContentRecord): boolean {
  return record.contentHtml.includes("wp-block-latest-posts");
}

async function fetchCards(records: WpContentRecord[]): Promise<Card[]> {
  const mediaIds = records
    .map((record) => record.featuredMediaId)
    .filter((id): id is number => id !== null && id !== undefined);
  const media = await getMediaByIds(mediaIds);
  return toCards(records, media);
}

export const buildShellData = cache(async (path: string): Promise<ShellData> => {
  const language = currentLanguage(path);
  const candidate = deriveCounterpartCandidate(path, language);
  const [alternateExists, navigation, footerPages, generatedAt] = await Promise.all([
    recordExists(candidate),
    getNavigation(),
    getTopLevelPages(language),
    getGeneratedAt(),
  ]);

  return {
    language,
    path,
    alternatePath: alternateExists ? candidate : language === "th" ? "/en" : "/",
    // Stored navigation needs no fallback records; pass [] for the legacy arg.
    navItems: buildPrimaryNavigation([], language, path, navigation[language]),
    footerNav: footerPages.slice(0, 8).map((page) => ({
      label: page.title,
      href: page.path,
      path: page.path,
      external: false,
      children: [],
    })),
    generatedAt,
  };
});

/** Everything a content page needs, in one cached call (shared by metadata + page). */
export const getPageData = cache(async (path: string): Promise<PageData | null> => {
  const importedRecord = await getRecordByPath(path);
  if (!importedRecord) {
    return null;
  }
  const record = applyContactMapOverride(importedRecord);

  const isHome = record.path === "/" || record.path === "/en";
  const isCategory = record.kind === "category";
  const isKnowledgeDocuments = isKnowledgeDocumentPath(record.path);
  const [
    childRecords,
    siblingRecords,
    latestRecords,
    shell,
    home,
    pdfReaderTargets,
    downloadIds,
  ] = await Promise.all([
    getChildren(record.path, record.language),
    record.parentPath
      ? getChildren(record.parentPath, record.language)
      : Promise.resolve([]),
    isHome && !hasImportedLatestPosts(record)
      ? getLatestPosts(record.language)
      : Promise.resolve([]),
    buildShellData(path),
    isHome ? buildHomeData(record) : Promise.resolve(null),
    buildPdfReaderTargets(record.contentHtml, {
      resolveDownload: getDownloadById,
      resolveFlipbookPdf: async (flipbookPath) => {
        const flipbook = await getRecordByPath(flipbookPath);
        const pdfPath = flipbook ? extractIframePdfSource(flipbook.contentHtml) : null;
        return pdfPath ? { pdfPath, title: flipbook?.title } : null;
      },
    }),
    isKnowledgeDocuments ? getDownloadIds() : Promise.resolve([]),
  ]);

  const parentRecord = record.parentPath
    ? await getRecordByPath(record.parentPath)
    : null;
  const [children, latest, newsCards, categoryPagination] = await Promise.all([
    fetchCards(childRecords),
    fetchCards(latestRecords),
    isCategory ? fetchCategoryNewsCards(record) : Promise.resolve([]),
    isCategory ? fetchCategoryPagination(record) : Promise.resolve(null),
  ]);

  return {
    record,
    children,
    latest,
    newsCards,
    categoryPagination,
    home,
    knowledgeDocuments: isKnowledgeDocuments
      ? buildKnowledgeDocumentGroups(record.contentHtml, {
          validDownloadIds: new Set(downloadIds),
        })
      : null,
    boardExecutivePresentation: buildBoardExecutivePresentation(
      record.path,
      record.contentHtml,
    ),
    pdfReaderTargets,
    sidebarItems:
      record.kind === "page"
        ? buildSidebarItems(record, childRecords, siblingRecords)
        : [],
    parentTitle: parentRecord?.title ?? record.title,
    shell,
  };
});

/**
 * For a category listing page, extract the <li> entries from
 * <ul class="wp-import-list"> and resolve each one's image via
 * featuredMediaId. Each <li> is `<a href=path>title<time/><p>excerpt</p></a>`.
 */
async function fetchCategoryNewsCards(record: WpContentRecord): Promise<Card[]> {
  const liMatches = [...record.contentHtml.matchAll(/<li>([\s\S]*?)<\/li>/g)];
  if (liMatches.length === 0) return [];

  const newsPaths: string[] = [];
  for (const m of liMatches) {
    const aMatch = m[1].match(/<a\s+href="([^"]+)"/);
    if (aMatch) newsPaths.push(aMatch[1]);
  }
  if (newsPaths.length === 0) return [];

  const newsRecords = (
    await Promise.all(newsPaths.map((p) => getRecordByPath(normalizeRoutePath(p))))
  ).filter((r): r is WpContentRecord => r !== null);

  return fetchCards(newsRecords);
}

/**
 * For a category listing page, compute pagination state: total pages,
 * current page (parsed from /page/N suffix), and base path. Uses the
 * authoritative post count from the DB so links stay correct even when
 * the listing HTML is out of sync.
 */
async function fetchCategoryPagination(
  record: WpContentRecord,
): Promise<CategoryPagination | null> {
  // record.path looks like /category/<slug> or /category/<slug>/page/<N>
  const m = record.path.match(/^\/category\/([^/]+)(?:\/page\/(\d+))?$/);
  if (!m) return null;
  const slug = decodeURIComponent(m[1]);
  const currentPage = m[2] ? parseInt(m[2], 10) : 1;

  const category = await getCategoryBySlug(slug);
  if (!category) return null;

  const totalPosts = await countPostsByCategory(category.id, record.language);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(totalPosts / pageSize));

  return {
    currentPage,
    totalPages,
    totalPosts,
    pageSize,
    basePath: `/category/${m[1]}`,
  };
}

async function buildHomeData(record: WpContentRecord): Promise<HomeData> {
  const [newsRecords, articleRecords, calendarDays] = await Promise.all([
    getPostsByCategory(CATEGORY_NEWS, record.language, 6),
    getPostsByCategory(CATEGORY_ARTICLES, record.language, 3),
    getPostCalendar(record.language),
  ]);
  const [news, articles] = await Promise.all([
    fetchCards(newsRecords),
    fetchCards(articleRecords),
  ]);
  return {
    news,
    articles,
    partners: extractPartnerLogos(record.contentHtml),
    calendarDays,
  };
}
