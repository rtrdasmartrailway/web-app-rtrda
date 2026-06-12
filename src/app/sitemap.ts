import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site-config";
import { getAllForSitemap } from "@/lib/db/queries";

// Reads the database at request time; never evaluated during `next build`.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await getAllForSitemap();

  return entries.slice(0, 50000).map((entry) => ({
    url: `${SITE_ORIGIN}${entry.path === "/" ? "" : entry.path}`,
    lastModified: entry.modified,
  }));
}
