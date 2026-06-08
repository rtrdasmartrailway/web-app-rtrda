export type WpLanguage = "th" | "en";

export type WpRouteKind = "page" | "post" | "category" | "flipbook" | "fallback";

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

export interface WpNavigationItem {
  label: string;
  path: string;
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
  };
  records: WpContentRecord[];
  categories: WpCategory[];
  media: WpMediaAsset[];
}
