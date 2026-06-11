export type WpLanguage = "th" | "en";

export type WpRouteKind =
  | "page"
  | "post"
  | "category"
  | "author"
  | "flipbook"
  | "fallback";

export interface WpContentRecord {
  id: string;
  wpId: number | string;
  language: WpLanguage;
  kind: WpRouteKind;
  path: string;
  sourceUrl: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  modified: string;
  date: string;
  parentPath: string | null;
  categoryIds: number[];
  featuredMediaId: number | null;
  /** Plain-text body used by site search; populated by the importer. */
  searchText?: string;
  /** WordPress author id, set on posts; used to build author archives. */
  authorId?: number | null;
}

export interface WpCategory {
  id: number;
  language: WpLanguage;
  path: string;
  slug: string;
  name: string;
  count: number;
  parent: number;
}

export interface WpMediaAsset {
  id: number | string;
  sourceUrl: string;
  localPath: string;
  title: string;
  alt: string;
  width: number | null;
  height: number | null;
  mimeType: string;
}

export interface WpDownloadAsset {
  id: string;
  sourceUrl: string;
  localPath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  title: string;
  group: string;
  sourcePages: string[];
}

export interface WpNavigationItem {
  label: string;
  href: string;
  path: string | null;
  external: boolean;
  children: WpNavigationItem[];
}

export interface WpImportManifest {
  generatedAt: string;
  source: string;
  counts: {
    pages: number;
    posts: number;
    media: number;
    categories: number;
    flipbooks: number;
    downloads: number;
  };
  records: WpContentRecord[];
  categories: WpCategory[];
  media: WpMediaAsset[];
  downloads: WpDownloadAsset[];
  navigation?: Record<WpLanguage, WpNavigationItem[]>;
}
