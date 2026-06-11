import { cache } from "react";
import { asc, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "./index";
import { wpContent, wpDownloads, wpMeta, wpNavigation } from "./schema";
import type { WpContentRecord, WpDownloadAsset, WpLanguage, WpNavigationItem } from "@/lib/wp/types";
import { normalizeRoutePath } from "@/lib/wp/url";

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
  const rows = await db
    .select()
    .from(wpContent)
    .where(eq(wpContent.path, normalized))
    .limit(1);
  return rows[0] ? rowToRecord(rows[0]) : null;
});

export async function getAllContentPaths(): Promise<{ path: string }[]> {
  return db.select({ path: wpContent.path }).from(wpContent);
}

export async function getChildPages(parentPath: string): Promise<WpContentRecord[]> {
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
  const rows = await db
    .select()
    .from(wpContent)
    .where(eq(wpContent.language, language))
    .orderBy(desc(wpContent.date))
    .limit(limit);
  return rows.filter((r) => r.kind === "post").map(rowToRecord);
}

export async function getTopLevelPages(language: WpLanguage): Promise<WpContentRecord[]> {
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
  const rows = await db
    .select()
    .from(wpNavigation)
    .where(eq(wpNavigation.language, language))
    .orderBy(asc(wpNavigation.sortOrder));

  // Rebuild tree from flat rows (top-level only for now — navigation is shallow)
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
  const term = `%${query}%`;
  const rows = await db
    .select()
    .from(wpContent)
    .where(or(ilike(wpContent.title, term), ilike(wpContent.excerpt, term), ilike(wpContent.path, term)))
    .limit(limit);
  return rows.map(rowToRecord);
}

export async function getDownloadById(id: string): Promise<WpDownloadAsset | null> {
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
  const rows = await db
    .select()
    .from(wpMeta)
    .where(eq(wpMeta.key, "generatedAt"))
    .limit(1);
  return rows[0]?.value ?? "";
}
