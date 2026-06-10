import type { Metadata } from "next";
import { SearchResults } from "@/components/rtrda-site";
import { searchContent } from "@/db/queries";

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
  const results = q.trim() ? await searchContent(q.trim(), 80) : [];

  return <SearchResults records={results} query={q} />;
}
