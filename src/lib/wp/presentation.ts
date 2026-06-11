import { normalizeRoutePath } from "./url";
import type {
  WpContentRecord,
  WpLanguage,
  WpMediaAsset,
  WpNavigationItem,
} from "./types";

export interface PresentationNavItem {
  label: string;
  href: string;
  path: string | null;
  external: boolean;
  active: boolean;
  children: PresentationNavItem[];
}

export interface PresentationSidebarItem {
  label: string;
  path: string;
  active: boolean;
}

export const STITCH_ASSETS = {
  homeHero: "/stitch-assets/home-hero.png",
  pageHero: "/stitch-assets/page-hero.png",
  railLab: "/stitch-assets/rail-lab.png",
  railNetwork: "/stitch-assets/rail-network.png",
  railStrategyMap: "/stitch-assets/rail-strategy-map.png",
} as const;

const PRIMARY_NAV: Record<WpLanguage, Array<{ label: string; path: string }>> = {
  th: [
    { label: "หน้าแรก", path: "/" },
    { label: "เกี่ยวกับ สทร.", path: "/เกี่ยวกับ-สทร" },
    { label: "ผลงานและโครงการเด่น", path: "/ผลงานและโครงการเด่น" },
    { label: "ข่าวสาร/กิจกรรม", path: "/ข่าวสาร-กิจกรรม" },
    { label: "เอกสารเผยแพร่", path: "/เอกสารเผยแพร่" },
    { label: "จัดซื้อจัดจ้าง", path: "/จัดซื้อจัดจ้าง" },
    { label: "ติดต่อเรา", path: "/ติดต่อเรา" },
  ],
  en: [
    { label: "Home", path: "/en" },
    { label: "About RTRDA", path: "/en/เกี่ยวกับ-สทร" },
    { label: "Our Projects", path: "/en/ผลงานและโครงการเด่น" },
    { label: "News & Activities", path: "/en/ข่าวสาร-กิจกรรม" },
    { label: "Publications", path: "/en/เอกสารเผยแพร่" },
    { label: "Procurement", path: "/en/จัดซื้อจัดจ้าง" },
    { label: "Contact Us", path: "/en/ติดต่อเรา" },
  ],
};

const PRIMARY_NAV_PATH_BY_LABEL: Record<WpLanguage, Map<string, string>> = {
  th: new Map(PRIMARY_NAV.th.map((item) => [item.label, item.path])),
  en: new Map(PRIMARY_NAV.en.map((item) => [item.label, item.path])),
};

function sortByTitle(language: WpLanguage) {
  return (a: WpContentRecord, b: WpContentRecord) =>
    a.title.localeCompare(b.title, language === "th" ? "th" : "en");
}

function isPathActive(itemPath: string, currentPath: string): boolean {
  const item = normalizeRoutePath(itemPath);
  const current = normalizeRoutePath(currentPath);

  if (item === "/" || item === "/en") {
    return current === item;
  }

  return current === item || current.startsWith(`${item}/`);
}

export function buildPrimaryNavigation(
  records: WpContentRecord[],
  language: WpLanguage,
  currentPath: string,
  navigation?: WpNavigationItem[],
): PresentationNavItem[] {
  if (navigation?.length) {
    return navigation.map((item) => mapNavigationItem(item, language, currentPath, true));
  }

  return PRIMARY_NAV[language].map((item) => {
    const children = records
      .filter((record) => record.language === language)
      .filter((record) => record.parentPath === item.path)
      .sort(sortByTitle(language))
      .map((record) => ({
        label: record.title,
        href: record.path,
        path: record.path,
        external: false,
        active: isPathActive(record.path, currentPath),
        children: [],
      }));

    return {
      label: item.label,
      href: item.path,
      path: item.path,
      external: false,
      active:
        isPathActive(item.path, currentPath) || children.some((child) => child.active),
      children,
    };
  });
}

function mapNavigationItem(
  item: WpNavigationItem,
  language: WpLanguage,
  currentPath: string,
  topLevel: boolean,
): PresentationNavItem {
  const children = item.children.map((child) =>
    mapNavigationItem(child, language, currentPath, false),
  );
  const activationPath =
    item.path ??
    (topLevel ? PRIMARY_NAV_PATH_BY_LABEL[language].get(item.label) : undefined);
  const active =
    (activationPath ? isPathActive(activationPath, currentPath) : false) ||
    children.some((child) => child.active);

  return {
    label: item.label,
    href: item.href,
    path: item.path,
    external: item.external,
    active,
    children,
  };
}

export function resolveFeaturedMediaPath(
  record: WpContentRecord,
  media: WpMediaAsset[],
): string | undefined {
  if (!record.featuredMediaId) {
    return undefined;
  }

  const asset = media.find((item) => String(item.id) === String(record.featuredMediaId));
  if (!asset?.mimeType.startsWith("image/")) {
    return undefined;
  }

  return asset.localPath;
}

export function getSidebarItems(
  records: WpContentRecord[],
  record: WpContentRecord,
): PresentationSidebarItem[] {
  const children = records
    .filter((candidate) => candidate.language === record.language)
    .filter((candidate) => candidate.parentPath === record.path)
    .sort(sortByTitle(record.language));

  const source =
    children.length > 0
      ? children
      : record.parentPath
        ? records
            .filter((candidate) => candidate.language === record.language)
            .filter((candidate) => candidate.parentPath === record.parentPath)
            .sort(sortByTitle(record.language))
        : [];

  return source.map((item) => ({
    label: item.title,
    path: item.path,
    active: normalizeRoutePath(item.path) === normalizeRoutePath(record.path),
  }));
}

export function selectFallbackAsset(record: WpContentRecord): string {
  if (record.kind === "category") {
    return STITCH_ASSETS.railNetwork;
  }

  if (record.kind === "flipbook") {
    return STITCH_ASSETS.railStrategyMap;
  }

  if (record.kind === "page" && /ผลงาน|project|strategy|ยุทธศาสตร์/i.test(record.path)) {
    return STITCH_ASSETS.railStrategyMap;
  }

  return STITCH_ASSETS.railLab;
}

export function resolveCardImagePath(
  record: WpContentRecord,
  media: WpMediaAsset[],
): string {
  return resolveFeaturedMediaPath(record, media) ?? selectFallbackAsset(record);
}
