import type { WpLanguage } from "@/lib/wp/types";

/**
 * Category landing pages. WordPress modelled these as `/category/{name}`
 * records; we keep them as static config (the set is small and fixed) instead of
 * a DB table. `newsCategory` maps to the `news.category` value whose items the
 * page lists — null means there is no news mapping (e.g. uncategorized).
 */
export interface CategoryDef {
  path: string;
  language: WpLanguage;
  title: string;
  newsCategory: string | null;
}

export const CATEGORIES: CategoryDef[] = [
  { path: "/category/ข่าวและกิจกรรม", language: "th", title: "ข่าวและกิจกรรม", newsCategory: "ข่าวและกิจกรรม" },
  { path: "/category/ความร่วมมือทั้งในและต่", language: "th", title: "ความร่วมมือทั้งในและต่างประเทศ", newsCategory: "ความร่วมมือ" },
  { path: "/category/บทความ", language: "th", title: "บทความ", newsCategory: "บทความ" },
  { path: "/category/ประกาศ", language: "th", title: "ประกาศ", newsCategory: "ประกาศ" },
  { path: "/category/uncategorized", language: "th", title: "Uncategorized", newsCategory: null },
  { path: "/category/uncategorized-en", language: "th", title: "Uncategorized", newsCategory: null },
  { path: "/en/category/ข่าวและกิจกรรม", language: "en", title: "ข่าวและกิจกรรม", newsCategory: "ข่าวและกิจกรรม" },
  { path: "/en/category/ความร่วมมือทั้งในและต่", language: "en", title: "ความร่วมมือทั้งในและต่างประเทศ", newsCategory: "ความร่วมมือ" },
  { path: "/en/category/บทความ", language: "en", title: "บทความ", newsCategory: "บทความ" },
  { path: "/en/category/ประกาศ", language: "en", title: "ประกาศ", newsCategory: "ประกาศ" },
  { path: "/en/category/uncategorized", language: "en", title: "Uncategorized", newsCategory: null },
  { path: "/en/category/uncategorized-en", language: "en", title: "Uncategorized", newsCategory: null },
];

const CATEGORY_BY_PATH = new Map(CATEGORIES.map((c) => [c.path, c]));

export function getCategoryByPath(path: string): CategoryDef | undefined {
  return CATEGORY_BY_PATH.get(path);
}
