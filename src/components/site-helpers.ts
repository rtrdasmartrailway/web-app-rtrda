import type { WpContentRecord, WpImportManifest, WpLanguage } from "@/lib/wp/types";
import { findContentByPath } from "@/lib/wp/content-store";

export function formatDate(value: string, language: WpLanguage): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-US", {
    dateStyle: "medium",
  }).format(date);
}

export function currentLanguage(path: string): WpLanguage {
  return path === "/en" || path.startsWith("/en/") ? "en" : "th";
}

export function counterpartPath(
  manifest: WpImportManifest,
  currentPath: string,
  language: WpLanguage,
): string {
  if (language === "th") {
    const englishPath = currentPath === "/" ? "/en" : `/en${currentPath}`;
    return findContentByPath(manifest.records, englishPath) ? englishPath : "/en";
  }

  const thaiPath = currentPath === "/en" ? "/" : currentPath.replace(/^\/en/, "") || "/";
  return findContentByPath(manifest.records, thaiPath) ? thaiPath : "/";
}

export function latestPosts(
  manifest: WpImportManifest,
  language: WpLanguage,
): WpContentRecord[] {
  return manifest.records
    .filter((record) => record.language === language && record.kind === "post")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);
}

export function relatedChildren(
  manifest: WpImportManifest,
  record: WpContentRecord,
): WpContentRecord[] {
  return manifest.records
    .filter((candidate) => candidate.parentPath === record.path)
    .sort((a, b) =>
      a.title.localeCompare(b.title, record.language === "th" ? "th" : "en"),
    );
}

export function parentTitle(manifest: WpImportManifest, record: WpContentRecord): string {
  if (!record.parentPath) {
    return record.title;
  }

  return findContentByPath(manifest.records, record.parentPath)?.title ?? record.title;
}

export function hasImportedLatestPosts(record: WpContentRecord): boolean {
  return record.contentHtml.includes("wp-block-latest-posts");
}
