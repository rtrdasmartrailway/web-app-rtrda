import type { MetadataRoute } from "next";
import { loadManifest } from "@/lib/wp/content-store";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const manifest = await loadManifest();

  return manifest.records.slice(0, 50000).map((record) => ({
    url: `https://test.rtrda.or.th${record.path === "/" ? "" : record.path}`,
    lastModified: record.modified,
  }));
}
