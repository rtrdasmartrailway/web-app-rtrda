import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { getPageData } from "@/lib/db/page-data";
import { normalizeRoutePath } from "@/lib/wp/url";

// Content lives in Postgres: render on demand, cache for 5 minutes (ISR).
// `next build` must not need the database, so nothing is prerendered.
export const revalidate = 300;
export const dynamicParams = true;

const logoImage = "/wp-content/uploads/2023/02/Logo_RTRDA_full-1.png";

export async function generateStaticParams() {
  return [];
}

function pathFromSlug(slug?: string[]): string {
  return normalizeRoutePath(slug && slug.length > 0 ? `/${slug.join("/")}` : "/");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPageData(pathFromSlug(slug));

  if (!data) {
    return {
      title: "Page not found | RTRDA",
    };
  }

  return {
    title: `${data.record.title} | RTRDA`,
    description: data.record.excerpt || data.record.title,
    alternates: {
      canonical: data.record.path,
    },
    openGraph: {
      title: `${data.record.title} | RTRDA`,
      description: data.record.excerpt || data.record.title,
      url: data.record.path,
      siteName: "RTRDA",
      images: [
        {
          url: logoImage,
          width: 364,
          height: 75,
          alt: "RTRDA Logo",
        },
      ],
      locale: data.record.language === "en" ? "en_US" : "th_TH",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${data.record.title} | RTRDA`,
      description: data.record.excerpt || data.record.title,
      images: [logoImage],
    },
  };
}

export default async function MigratedPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const data = await getPageData(pathFromSlug(slug));

  if (!data) {
    notFound();
  }

  return <ContentPage data={data} />;
}
