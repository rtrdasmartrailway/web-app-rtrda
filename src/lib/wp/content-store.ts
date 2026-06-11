import { readFile } from "node:fs/promises";
import path from "node:path";

import { normalizeRoutePath } from "./url";
import type {
  WpContentRecord,
  WpImportManifest,
  WpLanguage,
  WpNavigationItem,
} from "./types";

const manifestPath = path.join(process.cwd(), "src/data/wp-content.json");

const emptyManifest: WpImportManifest = {
  generatedAt: "",
  source: "https://www.rtrda.or.th",
  counts: {
    pages: 0,
    posts: 0,
    media: 0,
    categories: 0,
    flipbooks: 0,
    downloads: 0,
  },
  records: [],
  categories: [],
  media: [],
  downloads: [],
  navigation: {
    th: [],
    en: [],
  },
};

export function findContentByPath(
  records: WpContentRecord[],
  path: string,
): WpContentRecord | undefined {
  const normalized = normalizeRoutePath(path);
  return records.find((record) => normalizeRoutePath(record.path) === normalized);
}

export function getNavigationTree(
  records: WpContentRecord[],
  language: WpLanguage,
): WpNavigationItem[] {
  const topLevelPages = records
    .filter((record) => record.language === language)
    .filter((record) => record.kind === "page")
    .filter((record) => record.parentPath === null)
    .sort((a, b) => a.title.localeCompare(b.title, language === "th" ? "th" : "en"));

  return topLevelPages.map((record) => ({
    label: record.title,
    href: record.path,
    path: record.path,
    external: false,
    children: records
      .filter((child) => child.parentPath === record.path)
      .sort((a, b) => a.title.localeCompare(b.title, language === "th" ? "th" : "en"))
      .map((child) => ({
        label: child.title,
        href: child.path,
        path: child.path,
        external: false,
        children: [],
      })),
  }));
}

export async function loadManifest(): Promise<WpImportManifest> {
  try {
    const rawManifest = await readFile(manifestPath, "utf8");
    return JSON.parse(rawManifest) as WpImportManifest;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return emptyManifest;
    }

    throw error;
  }
}
