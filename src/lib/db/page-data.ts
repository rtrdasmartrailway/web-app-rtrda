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
import { normalizeRoutePath } from "@/lib/wp/url";
import { extractPartnerLogos } from "@/lib/wp/home";
import {
  CATEGORY_ARTICLES,
  CATEGORY_NEWS,
  getChildren,
  getGeneratedAt,
  getLatestPosts,
  getMediaByIds,
  getNavigation,
  getPostCalendar,
  getPostsByCategory,
  getRecordByPath,
  getStats,
  getTopLevelPages,
  recordExists,
  type CalendarDay,
  type SiteStats,
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

export interface PageData {
  record: WpContentRecord;
  children: Card[];
  latest: Card[];
  stats: SiteStats | null;
  /** Custom home-page sections; null for non-home pages. */
  home: HomeData | null;
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
  return source.map((item) => ({
    label: item.title,
    path: item.path,
    active: normalizeRoutePath(item.path) === normalizeRoutePath(record.path),
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
  const record = await getRecordByPath(path);
  if (!record) {
    return null;
  }

  const isHome = record.path === "/" || record.path === "/en";
  const [childRecords, siblingRecords, latestRecords, stats, shell, home] =
    await Promise.all([
      getChildren(record.path, record.language),
      record.parentPath
        ? getChildren(record.parentPath, record.language)
        : Promise.resolve([]),
      isHome && !hasImportedLatestPosts(record)
        ? getLatestPosts(record.language)
        : Promise.resolve([]),
      isHome ? getStats() : Promise.resolve(null),
      buildShellData(path),
      isHome ? buildHomeData(record) : Promise.resolve(null),
    ]);

  const parentRecord = record.parentPath
    ? await getRecordByPath(record.parentPath)
    : null;
  const [children, latest] = await Promise.all([
    fetchCards(childRecords),
    fetchCards(latestRecords),
  ]);

  return {
    record,
    children,
    latest,
    stats,
    home,
    sidebarItems:
      record.kind === "page"
        ? buildSidebarItems(record, childRecords, siblingRecords)
        : [],
    parentTitle: parentRecord?.title ?? record.title,
    shell,
  };
});

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
