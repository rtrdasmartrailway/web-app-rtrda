import type { MetadataRoute } from "next";
import { getAllContentPaths } from "@/db/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.rtrda.or.th";
  const paths = await getAllContentPaths();

  return paths.slice(0, 50000).map(({ path }) => ({
    url: `${siteUrl}${path === "/" ? "" : path}`,
  }));
}
