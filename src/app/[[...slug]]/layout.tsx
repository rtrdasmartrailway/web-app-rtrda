import { SiteShell } from "@/components/rtrda-shared";
import { normalizeRoutePath } from "@/lib/wp/url";

function pathFromSlug(slug?: string[]): string {
  return normalizeRoutePath(slug && slug.length > 0 ? `/${slug.join("/")}` : "/");
}

// The site chrome (navigation + footer) lives in the layout so it persists
// across client navigations. Because loading.tsx only replaces the page slot,
// the nav bar never flashes to a loading skeleton.
export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  return <SiteShell path={pathFromSlug(slug)}>{children}</SiteShell>;
}
