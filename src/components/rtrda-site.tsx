import Link from "next/link";
import Image from "next/image";
import type { WpContentRecord, WpLanguage } from "@/lib/wp/types";
import {
  getChildPages,
  getContentByPath,
  getGeneratedAt,
  getLatestPosts,
  getNavItems,
  getTopLevelPages,
} from "@/db/queries";
import { SiteFooter } from "./SiteFooter";
import {
  buildPrimaryNavigation,
  getSidebarItems,
  selectFallbackAsset,
  type PresentationSidebarItem,
} from "@/lib/wp/presentation";
import { RtrdaNavigation } from "./rtrda-navigation";

function formatDate(value: string, language: WpLanguage): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-US", {
    dateStyle: "medium",
  }).format(date);
}

function currentLanguage(path: string): WpLanguage {
  return path === "/en" || path.startsWith("/en/") ? "en" : "th";
}

async function resolveCounterpartPath(currentPath: string, language: WpLanguage): Promise<string> {
  if (language === "th") {
    const englishPath = currentPath === "/" ? "/en" : `/en${currentPath}`;
    const found = await getContentByPath(englishPath);
    return found ? englishPath : "/en";
  }

  const thaiPath = currentPath === "/en" ? "/" : currentPath.replace(/^\/en/, "") || "/";
  const found = await getContentByPath(thaiPath);
  return found ? thaiPath : "/";
}

function resolveCardImagePath(record: WpContentRecord): string {
  return record.featuredMediaPath ?? selectFallbackAsset(record);
}

function hasImportedLatestPosts(record: WpContentRecord): boolean {
  return record.contentHtml.includes("wp-block-latest-posts");
}

function ArticleCard({ record }: { record: WpContentRecord }) {
  const imagePath = resolveCardImagePath(record);
  const dateText = formatDate(record.date, record.language);

  return (
    <Link href={record.path} className="article-card">
      <span className="article-image">
        <Image
          src={imagePath}
          alt=""
          fill
          sizes="(max-width: 680px) 100vw, (max-width: 980px) 50vw, 33vw"
        />
      </span>
      <span className="article-content">
        {dateText ? <time dateTime={record.date}>{dateText}</time> : null}
        <strong>{record.title}</strong>
        {record.excerpt ? <span className="article-excerpt">{record.excerpt}</span> : null}
        <span className="read-link">{record.language === "th" ? "อ่านเพิ่มเติม" : "Continue Reading"}</span>
      </span>
    </Link>
  );
}

function SideNavigation({
  items,
  title,
}: {
  items: PresentationSidebarItem[];
  title: string;
}) {
  if (items.length === 0) return null;

  return (
    <aside className="page-sidebar" aria-label={title}>
      <h2>{title}</h2>
      <nav>
        {items.map((item) => (
          <Link key={item.path} href={item.path} className={item.active ? "active" : undefined}>
            <span>{item.label}</span>
            <span aria-hidden="true" className="sidebar-arrow" />
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export async function SiteShell({
  children,
  path,
}: {
  children: React.ReactNode;
  path: string;
}) {
  const language = currentLanguage(path);

  const [alternate, wpNavItems, topLevelPages, generatedAt] = await Promise.all([
    resolveCounterpartPath(path, language),
    getNavItems(language),
    getTopLevelPages(language),
    getGeneratedAt(),
  ]);

  const navItems = buildPrimaryNavigation(
    topLevelPages,
    language,
    path,
    wpNavItems.length ? wpNavItems : undefined,
  );

  return (
    <div className="site-shell">
      <RtrdaNavigation alternatePath={alternate} language={language} navItems={navItems} />
      <main>{children}</main>
      <SiteFooter language={language} generatedAt={generatedAt} />
    </div>
  );
}

export async function ContentPage({ record }: { record: WpContentRecord }) {
  const { language } = record;
  const isHome = record.path === "/" || record.path === "/en";

  const [children, latest, siblingCandidates, parentRecord] = await Promise.all([
    getChildPages(record.path),
    isHome && !hasImportedLatestPosts(record) ? getLatestPosts(language, 6) : Promise.resolve([]),
    record.kind === "page" && record.parentPath ? getChildPages(record.parentPath) : Promise.resolve([]),
    record.parentPath ? getContentByPath(record.parentPath) : Promise.resolve(null),
  ]);

  const sidebarPool = children.length > 0 ? children : siblingCandidates;
  const sidebarItems = record.kind === "page" ? getSidebarItems(sidebarPool, record) : [];
  const sidebarTitle = parentRecord?.title ?? record.title;
  const dateText = formatDate(record.date, language);

  return (
    <SiteShell path={record.path}>
      <article className={`content-page content-${record.kind} ${isHome ? "content-home" : ""}`}>
        <section className={`page-hero ${isHome ? "home-hero" : ""}`}>
          <div className="site-container hero-inner">
            <p className="breadcrumb">
              <Link href={language === "th" ? "/" : "/en"}>
                {language === "th" ? "หน้าแรก" : "Home"}
              </Link>
              {!isHome ? <span> / {record.title}</span> : null}
            </p>
            <h1>{record.title}</h1>
            {record.kind === "post" && dateText ? <time dateTime={record.date}>{dateText}</time> : null}
            {record.excerpt ? <p className="hero-excerpt">{record.excerpt}</p> : null}
            {isHome ? (
              <a className="hero-button" href="#main-content">
                {language === "th" ? "ดูข้อมูลล่าสุด" : "Explore Content"}
                <span aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </section>

        <div
          className={`site-container content-layout ${sidebarItems.length > 0 ? "with-sidebar" : ""}`}
          id="main-content"
        >
          <SideNavigation items={sidebarItems} title={sidebarTitle} />

          <div className="content-main">
            <div className="wp-content" dangerouslySetInnerHTML={{ __html: record.contentHtml }} />

            {children.length > 0 ? (
              <section className="related-section" aria-labelledby="related-pages-title">
                <div className="section-heading-row">
                  <h2 id="related-pages-title">
                    {language === "th" ? "เนื้อหาที่เกี่ยวข้อง" : "Related pages"}
                  </h2>
                </div>
                <div className="related-grid">
                  {children.map((child) => (
                    <ArticleCard key={child.id} record={child} />
                  ))}
                </div>
              </section>
            ) : null}

            {latest.length > 0 ? (
              <section className="latest-section" aria-labelledby="latest-posts-title">
                <div className="section-heading-row">
                  <h2 id="latest-posts-title">
                    {language === "th" ? "ข่าวล่าสุด" : "Latest news"}
                  </h2>
                </div>
                <div className="related-grid">
                  {latest.map((post) => (
                    <ArticleCard key={post.id} record={post} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </article>
    </SiteShell>
  );
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
