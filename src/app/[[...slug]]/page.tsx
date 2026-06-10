import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/rtrda-site";
import { getAllContentPaths, getContentByPath } from "@/db/queries";
import { normalizeRoutePath } from "@/lib/wp/url";

function pathFromSlug(slug?: string[]): string {
  return normalizeRoutePath(slug && slug.length > 0 ? `/${slug.join("/")}` : "/");
}

export async function generateStaticParams() {
  const paths = await getAllContentPaths();
  return paths.map(({ path }) => ({
    slug: path === "/" ? [] : path.split("/").filter(Boolean),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const record = await getContentByPath(pathFromSlug(slug));

  if (!record) {
    return { title: "Page not found | RTRDA" };
  }

  return {
    title: `${record.title} | RTRDA`,
    description: record.excerpt || record.title,
    alternates: { canonical: record.path },
  };
}

export default async function MigratedPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const record = await getContentByPath(pathFromSlug(slug));

  if (!record) {
    notFound();
  }

  return <ContentPage record={record} />;
}
