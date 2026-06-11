import Link from "next/link";
import type { WpImportManifest, WpLanguage } from "@/lib/wp/types";
import { ArticleCard } from "./article-card";
import { SiteShell } from "./site-shell";

export function SearchResults({
  manifest,
  query,
  language = "th",
}: {
  manifest: WpImportManifest;
  query: string;
  language?: WpLanguage;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const results = normalizedQuery
    ? manifest.records
        .filter((record) => record.language === language)
        .map((record) => {
          const titleHaystack = `${record.title} ${record.excerpt}`.toLowerCase();
          const bodyHaystack = (record.searchText ?? "").toLowerCase();
          if (titleHaystack.includes(normalizedQuery)) {
            return { record, rank: 0 };
          }
          if (bodyHaystack.includes(normalizedQuery)) {
            return { record, rank: 1 };
          }
          return null;
        })
        .filter((entry) => entry !== null)
        .sort(
          (a, b) =>
            a.rank - b.rank ||
            new Date(b.record.date).getTime() - new Date(a.record.date).getTime(),
        )
        .slice(0, 80)
        .map((entry) => entry.record)
    : [];

  const searchTitle = language === "th" ? "ผลการค้นหา" : "Search results";
  const homePath = language === "th" ? "/" : "/en";

  return (
    <SiteShell manifest={manifest} path="/search">
      <section className="page-hero">
        <div className="site-container hero-inner">
          <p className="breadcrumb">
            <Link href={homePath}>{language === "th" ? "หน้าแรก" : "Home"}</Link> /{" "}
            {searchTitle}
          </p>
          <h1>{searchTitle}</h1>
          {query ? <p className="hero-excerpt">{query}</p> : null}
        </div>
      </section>
      <section className="site-container search-results">
        <form action="/search" className="large-search">
          <input name="q" defaultValue={query} type="search" aria-label={searchTitle} />
          {language === "en" ? <input type="hidden" name="lang" value="en" /> : null}
          <button type="submit">{language === "th" ? "ค้นหา" : "Search"}</button>
        </form>
        <div className="search-grid">
          {results.map((record) => (
            <ArticleCard key={record.id} manifest={manifest} record={record} />
          ))}
        </div>
        {normalizedQuery && results.length === 0 ? (
          <p>{language === "th" ? "ไม่พบผลการค้นหา" : "No results found."}</p>
        ) : null}
      </section>
    </SiteShell>
  );
}
