import Link from "next/link";
import type { Card, ShellData } from "@/lib/db/page-data";
import type { WpLanguage } from "@/lib/wp/types";
import { ArticleCard } from "./article-card";
import { SiteShell } from "./site-shell";

export function SearchResults({
  results,
  query,
  language,
  shell,
}: {
  results: Card[];
  query: string;
  language: WpLanguage;
  shell: ShellData;
}) {
  const searchTitle = language === "th" ? "ผลการค้นหา" : "Search results";
  const homePath = language === "th" ? "/" : "/en";

  return (
    <SiteShell shell={shell}>
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
          {results.map((card) => (
            <ArticleCard key={card.record.id} card={card} />
          ))}
        </div>
        {query.trim() && results.length === 0 ? (
          <p>{language === "th" ? "ไม่พบผลการค้นหา" : "No results found."}</p>
        ) : null}
      </section>
    </SiteShell>
  );
}
