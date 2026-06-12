import Link from "next/link";
import type { WpContentRecord } from "@/lib/wp/types";
import { ArticleCard, SiteShell } from "./rtrda-shared";
import { HomePage } from "./pages/HomePage";
import { StandardPage } from "./pages/StandardPage";
import { PostPage } from "./pages/PostPage";
import { CategoryPage } from "./pages/CategoryPage";
import { FlipbookPage } from "./pages/FlipbookPage";
import { FallbackPage } from "./pages/FallbackPage";

export { SiteShell } from "./rtrda-shared";

export async function ContentPage({ record }: { record: WpContentRecord }) {
  const { path, kind } = record;

  if (path === "/" || path === "/en") return <HomePage record={record} />;
  if (kind === "post")                return <PostPage record={record} />;
  if (kind === "category")            return <CategoryPage record={record} />;
  if (kind === "flipbook")            return <FlipbookPage record={record} />;
  if (kind === "fallback")            return <FallbackPage record={record} />;
  return <StandardPage record={record} />;
}

export function SearchResults({
  records,
  query,
}: {
  records: WpContentRecord[];
  query: string;
}) {
  return (
    <SiteShell path="/search">
      <section className="page-hero">
        <div className="site-container hero-inner">
          <p className="breadcrumb">
            <Link href="/">หน้าแรก</Link> / Search
          </p>
          <h1>Search</h1>
          {query ? <p className="hero-excerpt">{query}</p> : null}
        </div>
      </section>
      <section className="site-container search-results">
        <form action="/search" className="large-search">
          <input name="q" defaultValue={query} type="search" aria-label="Search" />
          <button type="submit">Search</button>
        </form>
        <div className="search-grid">
          {records.map((record) => (
            <ArticleCard key={record.id} record={record} />
          ))}
        </div>
        {query.trim() && records.length === 0 ? <p>No results found.</p> : null}
      </section>
    </SiteShell>
  );
}
