import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/rtrda-site";
import { findContentByPath, loadManifest } from "@/lib/wp/content-store";
import { normalizeRoutePath } from "@/lib/wp/url";

function pathFromSlug(slug?: string[]): string {
  return normalizeRoutePath(slug && slug.length > 0 ? `/${slug.join("/")}` : "/");
}

export async function generateStaticParams() {
  const manifest = await loadManifest();
  return manifest.records.map((record) => ({
    slug: record.path === "/" ? [] : record.path.split("/").filter(Boolean),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const manifest = await loadManifest();
  const { slug } = await params;
  const path = pathFromSlug(slug);
  const record = findContentByPath(manifest.records, path);

  if (!record) {
    return {
      title: "Page not found | RTRDA",
    };
  }

  return {
    title: `${record.title} | RTRDA`,
    description: record.excerpt || record.title,
    alternates: {
      canonical: record.path,
    },
  };
}

export default async function MigratedPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const manifest = await loadManifest();
  const { slug } = await params;
  const path = pathFromSlug(slug);
  const record = findContentByPath(manifest.records, path);

  if (!record) {
    notFound();
  }

  return <ContentPage manifest={manifest} record={record} />;
}
