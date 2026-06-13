import type { Metadata } from "next";
import { SearchResults } from "@/components/rtrda-site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search | RTRDA",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  return <SearchResults query={q} />;
}
