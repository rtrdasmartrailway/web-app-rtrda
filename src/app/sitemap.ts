import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site-config";
import { loadManifest } from "@/lib/wp/content-store";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const manifest = await loadManifest();

  return manifest.records.slice(0, 50000).map((record) => ({
    url: `${SITE_ORIGIN}${record.path === "/" ? "" : record.path}`,
    lastModified: record.modified,
  }));
}
