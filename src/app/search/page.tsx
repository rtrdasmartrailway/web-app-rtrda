import type { Metadata } from "next";
import { SearchResults } from "@/components/rtrda-site";
import { loadManifest } from "@/lib/wp/content-store";

export const metadata: Metadata = {
  title: "Search | RTRDA",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const manifest = await loadManifest();
  const { q = "" } = await searchParams;

  return <SearchResults manifest={manifest} query={q} />;
}
