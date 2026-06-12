import type { Metadata } from "next";
import { SearchResults } from "@/components/search-results";
import { buildShellData, toCards } from "@/lib/db/page-data";
import { getMediaByIds, searchRecords } from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "Search | RTRDA",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; lang?: string }>;
}) {
  const { q = "", lang } = await searchParams;
  const language = lang === "en" ? "en" : "th";

  const [records, shell] = await Promise.all([
    searchRecords(q, language),
    buildShellData(language === "en" ? "/en" : "/"),
  ]);
  const media = await getMediaByIds(
    records
      .map((record) => record.featuredMediaId)
      .filter((id): id is number => id !== null && id !== undefined),
  );

  return (
    <SearchResults
      results={toCards(records, media)}
      query={q}
      language={language}
      shell={{ ...shell, path: "/search" }}
    />
  );
}
