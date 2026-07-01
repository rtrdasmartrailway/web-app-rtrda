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
  buildHighSpeedRailPdfReaderTargets,
  isRailStandardsPath,
} from "@/lib/wp/high-speed-rail-standards";
import {
  buildKnowledgeDocumentGroups,
  isKnowledgeDocumentPath,
  type KnowledgeDocumentGroup,
} from "@/lib/wp/knowledge-documents";
import {
  buildBoardExecutivePresentation,
  type BoardExecutivePresentation,
} from "@/lib/wp/board-executives";
import { applyBoardExecutiveOverride } from "@/lib/wp/board-executive-override";
import { applyContactMapOverride } from "@/lib/wp/contact-map";
import { applyItaHeadingsOverride } from "@/lib/wp/ita-headings-override";
import { getStaticDownloadOverride } from "@/lib/wp/static-download-overrides";
import { getSupplementalKnowledgePage } from "@/lib/wp/knowledge-supplemental-documents";
import { getLandingGuidePage } from "@/lib/wp/landing-guide-pages";
import { getMoralityReportPage } from "@/lib/wp/morality-report-documents";
import { applyProcurementPlanOverride } from "@/lib/wp/procurement-plan";
import { applyProcurementWinnerOverride } from "@/lib/wp/procurement-winner";
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
  navItems: PresentationNavItem[] = [],
): PresentationSidebarItem[] {
  const navSidebarItems = buildSidebarItemsFromNavigation(record, navItems);
  if (navSidebarItems.length > 0) {
    return navSidebarItems;
  }

  const source = children.length > 0 ? children : record.parentPath ? siblings : [];
  // Filter out the current page itself (a "siblings = [self]" result is useless
  // for navigation). Keep it when there are other siblings so the active page
  // can be highlighted in the sidebar. When everything is filtered out, return [] so the layout
  // collapses sidebar and gives content-main the full width.
  const selfPath = normalizeRoutePath(record.path);
  const filtered =
    source.length > 1
      ? source
      : source.filter((item) => normalizeRoutePath(item.path) !== selfPath);
  return filtered.map((item) => ({
    label: item.title,
    href: item.path,
    path: item.path,
    external: false,
    active: isSidebarPathActive(item.path, record.path),
  }));
}

function buildSidebarItemsFromNavigation(
  record: WpContentRecord,
  navItems: PresentationNavItem[],
): PresentationSidebarItem[] {
  const currentPath = normalizeRoutePath(record.path);
  const activeTopLevel = navItems.find(
    (item) =>
      item.active ||
      (item.path ? isSidebarPathActive(item.path, currentPath) : false) ||
      item.children.some((child) => navItemContainsPath(child, currentPath)),
  );

  if (!activeTopLevel || activeTopLevel.children.length === 0) {
    return [];
  }

  return flattenSidebarNavItems(activeTopLevel.children, record.path);
}

function getNavigationSidebarTitle(
  record: WpContentRecord,
  navItems: PresentationNavItem[],
  fallback: string,
): string {
  const currentPath = normalizeRoutePath(record.path);
  const activeTopLevel = navItems.find(
    (item) =>
      item.active ||
      (item.path ? isSidebarPathActive(item.path, currentPath) : false) ||
      item.children.some((child) => navItemContainsPath(child, currentPath)),
  );

  return activeTopLevel?.label ?? fallback;
}

function flattenSidebarNavItems(
  items: PresentationNavItem[],
  currentPath: string,
): PresentationSidebarItem[] {
  return items.flatMap((item) => {
    const children = flattenSidebarNavItems(item.children, currentPath);
    if (!item.path && !item.external) {
      return children;
    }

    return [
      {
        label: item.label,
        href: item.href,
        path: item.path,
        external: item.external,
        active: item.path ? isSidebarPathActive(item.path, currentPath) : false,
      },
      ...children,
    ];
  });
}

function navItemContainsPath(item: PresentationNavItem, currentPath: string): boolean {
  return (
    (item.path ? isSidebarPathActive(item.path, currentPath) : false) ||
    item.children.some((child) => navItemContainsPath(child, currentPath))
  );
}

function isSidebarPathActive(itemPath: string, currentPath: string): boolean {
  const item = normalizeRoutePath(itemPath);
  const current = normalizeRoutePath(currentPath);

  if (item === "/" || item === "/en") {
    return current === item;
  }

  return current === item || current.startsWith(`${item}/`);
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
    const supplementalPage = getSupplementalKnowledgePage(path);
    const landingGuidePage = getLandingGuidePage(path);
    const moralityReportPage = getMoralityReportPage(path);
    if (!supplementalPage && !landingGuidePage && !moralityReportPage) {
      return null;
    }

    const syntheticPage = supplementalPage
      ? {
          slug: supplementalPage.slug,
          path: supplementalPage.path,
          title: supplementalPage.title,
          groups: supplementalPage.groups,
          contentHtml: "",
          parentTitle: "บริการและข้อมูลสำคัญ",
          parentPath: "/บริการและข้อมูลสำคัญ",
          idPrefix: "supplemental-knowledge",
        }
      : landingGuidePage
        ? {
            slug: landingGuidePage.slug,
            path: landingGuidePage.path,
            title: landingGuidePage.title,
            groups:
              landingGuidePage.kind === "knowledge" ? landingGuidePage.groups : null,
            contentHtml:
              landingGuidePage.kind === "standalone-pdf" && landingGuidePage.pdfHref
                ? `<div class="standalone-pdf-page"><p><a href="${landingGuidePage.pdfHref}" target="_blank" rel="noreferrer">เปิด PDF ในแท็บใหม่</a></p><iframe src="${landingGuidePage.pdfHref}#toolbar=1&navpanes=1&view=FitH" title="${landingGuidePage.title}" loading="lazy"></iframe></div>`
                : "",
            parentTitle: "บริการและข้อมูลสำคัญ",
            parentPath: "/บริการและข้อมูลสำคัญ",
            idPrefix: "landing-guide",
          }
        : {
            slug: moralityReportPage!.slug,
            path: moralityReportPage!.path,
            title: moralityReportPage!.title,
            groups: moralityReportPage!.groups,
            contentHtml: "",
            parentTitle: "เอกสารเผยแพร่",
            parentPath: "/เอกสารเผยแพร่",
            idPrefix: "morality-report",
          };

    const shell = await buildShellData(path);
    const now = new Date().toISOString();
    const record: WpContentRecord = {
      id: `${syntheticPage.idPrefix}-${syntheticPage.slug}`,
      wpId: `${syntheticPage.idPrefix}-${syntheticPage.slug}`,
      language: "th",
      kind: "page",
      path: syntheticPage.path,
      sourceUrl: `https://test.rtrda.or.th${syntheticPage.path}`,
      title: syntheticPage.title,
      excerpt: syntheticPage.title,
      contentHtml: syntheticPage.contentHtml,
      searchText: syntheticPage.title,
      modified: now,
      date: now,
      parentPath: syntheticPage.parentPath,
      categoryIds: [],
      featuredMediaId: null,
      authorId: null,
    };

    const syntheticSidebarItems = buildSidebarItems(record, [], [], shell.navItems);

    return {
      record,
      children: [],
      latest: [],
      newsCards: [],
      categoryPagination: null,
      home: null,
      knowledgeDocuments: syntheticPage.groups,
      boardExecutivePresentation: null,
      pdfReaderTargets: [],
      sidebarItems: syntheticSidebarItems,
      parentTitle: syntheticPage.parentTitle,
      shell,
    };
  }
  const record = applyItaHeadingsOverride(
    applyBoardExecutiveOverride(
      applyProcurementPlanOverride(applyContactMapOverride(importedRecord)),
    ),
  );
  const recordWithOverrides = applyProcurementWinnerOverride(record);

  const isHome = recordWithOverrides.path === "/" || recordWithOverrides.path === "/en";
  const isCategory = recordWithOverrides.kind === "category";
  const isKnowledgeDocuments = isKnowledgeDocumentPath(recordWithOverrides.path);
  const isRailStandards = isRailStandardsPath(recordWithOverrides.path);
  const [
    childRecords,
    siblingRecords,
    latestRecords,
    shell,
    home,
    pdfReaderTargets,
    downloadIds,
  ] = await Promise.all([
    getChildren(recordWithOverrides.path, recordWithOverrides.language),
    recordWithOverrides.parentPath
      ? getChildren(recordWithOverrides.parentPath, recordWithOverrides.language)
      : Promise.resolve([]),
    isHome && !hasImportedLatestPosts(recordWithOverrides)
      ? getLatestPosts(recordWithOverrides.language)
      : Promise.resolve([]),
    buildShellData(path),
    isHome ? buildHomeData(recordWithOverrides) : Promise.resolve(null),
    buildPdfReaderTargets(recordWithOverrides.contentHtml, {
      resolveDownload: async (id) =>
        (await getDownloadById(id)) ?? getStaticDownloadOverride(id),
      resolveFlipbookPdf: async (flipbookPath) => {
        const flipbook = await getRecordByPath(flipbookPath);
        const pdfPath = flipbook ? extractIframePdfSource(flipbook.contentHtml) : null;
        return pdfPath ? { pdfPath, title: flipbook?.title } : null;
      },
    }),
    isKnowledgeDocuments ? getDownloadIds() : Promise.resolve([]),
  ]);
  const pagePdfReaderTargets = isRailStandards
    ? [...buildHighSpeedRailPdfReaderTargets(), ...pdfReaderTargets]
    : pdfReaderTargets;

  const parentRecord = recordWithOverrides.parentPath
    ? await getRecordByPath(recordWithOverrides.parentPath)
    : null;
  const [children, latest, newsCards, categoryPagination] = await Promise.all([
    fetchCards(childRecords),
    fetchCards(latestRecords),
    isCategory ? fetchCategoryNewsCards(recordWithOverrides) : Promise.resolve([]),
    isCategory ? fetchCategoryPagination(recordWithOverrides) : Promise.resolve(null),
  ]);

  return {
    record: recordWithOverrides,
    children,
    latest,
    newsCards,
    categoryPagination,
    home,
    knowledgeDocuments: isKnowledgeDocuments
      ? buildKnowledgeDocumentGroups(recordWithOverrides.contentHtml, {
          validDownloadIds: new Set(downloadIds),
        })
      : null,
    boardExecutivePresentation: buildBoardExecutivePresentation(
      recordWithOverrides.path,
      recordWithOverrides.contentHtml,
    ),
    pdfReaderTargets: pagePdfReaderTargets,
    sidebarItems:
      recordWithOverrides.kind === "page" || isCategory
        ? buildSidebarItems(
            recordWithOverrides,
            childRecords,
            siblingRecords,
            shell.navItems,
          )
        : [],
    parentTitle: isCategory
      ? getNavigationSidebarTitle(
          recordWithOverrides,
          shell.navItems,
          recordWithOverrides.title,
        )
      : (parentRecord?.title ?? recordWithOverrides.title),
    shell,
  };
});

/**
 * For a category listing page, extract the <li> entries from
 * <ul class="wp-import-list"> and resolve each one's image via
 * featuredMediaId. Each <li> is `<a href=path>title<time/><p>excerpt</p></a>`.
 */
async function fetchCategoryNewsCards(record: WpContentRecord): Promise<Card[]> {
  const categoryMatch = record.path.match(/^\/category\/([^/]+)(?:\/page\/(\d+))?$/);
  if (categoryMatch) {
    const slug = decodeURIComponent(categoryMatch[1]);
    const category = await getCategoryBySlug(slug);
    if (category) {
      return fetchCards(await getPostsByCategory(category.id, record.language, 10));
    }
  }

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

  return fetchCards(sortCategoryNewsByDateDesc(newsRecords));
}

/** Sort category news records by date descending (newest first). */
export function sortCategoryNewsByDateDesc(
  records: WpContentRecord[],
): WpContentRecord[] {
  return [...records].sort((a, b) => b.date.localeCompare(a.date));
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
