export type WpLanguage = "th" | "en";

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
