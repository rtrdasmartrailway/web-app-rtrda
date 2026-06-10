import Link from "next/link";
import Image from "next/image";
import type { WpContentRecord, WpImportManifest, WpLanguage } from "@/lib/wp/types";
import { findContentByPath } from "@/lib/wp/content-store";
import { SiteFooter } from "./SiteFooter";
import {
  buildPrimaryNavigation,
  getSidebarItems,
  resolveCardImagePath,
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

function counterpartPath(
  manifest: WpImportManifest,
  currentPath: string,
  language: WpLanguage,
): string {
  if (language === "th") {
    const englishPath = currentPath === "/" ? "/en" : `/en${currentPath}`;
    return findContentByPath(manifest.records, englishPath) ? englishPath : "/en";
  }

  const thaiPath = currentPath === "/en" ? "/" : currentPath.replace(/^\/en/, "") || "/";
  return findContentByPath(manifest.records, thaiPath) ? thaiPath : "/";
}

function latestPosts(manifest: WpImportManifest, language: WpLanguage): WpContentRecord[] {
  return manifest.records
    .filter((record) => record.language === language && record.kind === "post")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);
}

function relatedChildren(
  manifest: WpImportManifest,
  record: WpContentRecord,
): WpContentRecord[] {
  return manifest.records
    .filter((candidate) => candidate.parentPath === record.path)
    .sort((a, b) => a.title.localeCompare(b.title, record.language === "th" ? "th" : "en"));
}

function parentTitle(manifest: WpImportManifest, record: WpContentRecord): string {
  if (!record.parentPath) {
    return record.title;
  }

  return findContentByPath(manifest.records, record.parentPath)?.title ?? record.title;
}

function hasImportedLatestPosts(record: WpContentRecord): boolean {
  return record.contentHtml.includes("wp-block-latest-posts");
}

function ArticleCard({
  manifest,
  record,
}: {
  manifest: WpImportManifest;
  record: WpContentRecord;
}) {
  const imagePath = resolveCardImagePath(record, manifest.media);
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
  if (items.length === 0) {
    return null;
  }

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

export function SiteShell({
  children,
  manifest,
  path,
}: {
  children: React.ReactNode;
  manifest: WpImportManifest;
  path: string;
}) {
  const language = currentLanguage(path);
  const alternate = counterpartPath(manifest, path, language);
  const navigationTree = getNavigationTree(manifest.records, language).slice(0, 8);
  const navItems = buildPrimaryNavigation(
    manifest.records,
    language,
    path,
    manifest.navigation?.[language],
  );

  return (
    <div className="site-shell">
      <RtrdaNavigation alternatePath={alternate} language={language} navItems={navItems} />

      <main>{children}</main>

      <footer className="site-footer">
        <div className="footer-topline" />
        <div className="site-container footer-grid">
          <section className="footer-brand">
            <Image
              src="/wp-content/uploads/2023/02/Logo_RTRDA_full-1.png"
              alt="RTRDA"
              width={220}
              height={62}
            />
            <h2>
              {language === "th"
                ? "สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง"
                : "Rail Technology Research and Development Agency"}
            </h2>
            <p>
              {language === "th"
                ? "หน่วยงานวิจัยและพัฒนาเทคโนโลยีระบบราง เพื่อยกระดับระบบรางไทยอย่างยั่งยืน"
                : "Research and development for Thailand rail technology and sustainable rail systems."}
            </p>
            <p className="freshness">
              {language === "th" ? "ข้อมูลนำเข้าล่าสุด" : "Imported"}: {generatedDate}
            </p>
          </section>
          <section>
            <h2>{language === "th" ? "หน่วยงานภาครัฐ" : "Government Agencies"}</h2>
            <ul>
              <li>
                <a href="https://www.mot.go.th" rel="noreferrer">
                  {language === "th" ? "กระทรวงคมนาคม" : "Ministry of Transport"}
                </a>
              </li>
              <li>
                <a href="https://www.drt.go.th" rel="noreferrer">
                  {language === "th" ? "กรมการขนส่งทางราง" : "Department of Rail Transport"}
                </a>
              </li>
              <li>
                <a href="https://www.railway.co.th" rel="noreferrer">
                  {language === "th" ? "การรถไฟแห่งประเทศไทย" : "State Railway of Thailand"}
                </a>
              </li>
            </ul>
          </section>
          <section>
            <h2>{language === "th" ? "เมนูหลัก" : "Quick Links"}</h2>
            <ul>
              {navigationTree.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2>{language === "th" ? "ติดต่อ" : "Contact Us"}</h2>
            <p>99 กระทรวงคมนาคม ถนนราชดำเนินนอก แขวงวัดโสมนัส เขตป้อมปราบศัตรูพ่าย กรุงเทพฯ</p>
            <p>
              <a href="mailto:info@rtrda.or.th">info@rtrda.or.th</a>
            </p>
            <p>
              <a href="tel:0822042998">082 204 2998</a>
            </p>
          </section>
        </div>
        <div className="footer-bottom">
          <div className="site-container">
            © 2024 Rail Technology Research and Development Agency (RTRDA). All Rights Reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

export function ContentPage({
  manifest,
  record,
}: {
  manifest: WpImportManifest;
  record: WpContentRecord;
}) {
  const children = relatedChildren(manifest, record);
  const isHome = record.path === "/" || record.path === "/en";
  const latest = isHome && !hasImportedLatestPosts(record) ? latestPosts(manifest, record.language) : [];
  const dateText = formatDate(record.date, record.language);
  const sidebarItems = record.kind === "page" ? getSidebarItems(manifest.records, record) : [];
  const sidebarTitle = parentTitle(manifest, record);

  return (
    <SiteShell manifest={manifest} path={record.path}>
      <article className={`content-page content-${record.kind} ${isHome ? "content-home" : ""}`}>
        <section className={`page-hero ${isHome ? "home-hero" : ""}`}>
          <div className="site-container hero-inner">
            <p className="breadcrumb">
              <Link href={record.language === "th" ? "/" : "/en"}>
                {record.language === "th" ? "หน้าแรก" : "Home"}
              </Link>
              {!isHome ? <span> / {record.title}</span> : null}
            </p>
            <h1>{record.title}</h1>
            {record.kind === "post" && dateText ? <time dateTime={record.date}>{dateText}</time> : null}
            {record.excerpt ? <p className="hero-excerpt">{record.excerpt}</p> : null}
            {isHome ? (
              <a className="hero-button" href="#main-content">
                {record.language === "th" ? "ดูข้อมูลล่าสุด" : "Explore Content"}
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
                    {record.language === "th" ? "เนื้อหาที่เกี่ยวข้อง" : "Related pages"}
                  </h2>
                </div>
                <div className="related-grid">
                  {children.map((child) => (
                    <ArticleCard key={child.id} manifest={manifest} record={child} />
                  ))}
                </div>
              </section>
            ) : null}

            {latest.length > 0 ? (
              <section className="latest-section" aria-labelledby="latest-posts-title">
                <div className="section-heading-row">
                  <h2 id="latest-posts-title">
                    {record.language === "th" ? "ข่าวล่าสุด" : "Latest news"}
                  </h2>
                </div>
                <div className="related-grid">
                  {latest.map((post) => (
                    <ArticleCard key={post.id} manifest={manifest} record={post} />
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
  manifest,
  query,
}: {
  manifest: WpImportManifest;
  query: string;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const results = normalizedQuery
    ? manifest.records
        .filter((record) => {
          const haystack = `${record.title} ${record.excerpt} ${record.path}`.toLowerCase();
          return haystack.includes(normalizedQuery);
        })
        .slice(0, 80)
    : [];

  return (
    <SiteShell manifest={manifest} path="/search">
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
          {results.map((record) => (
            <ArticleCard key={record.id} manifest={manifest} record={record} />
          ))}
        </div>
        {normalizedQuery && results.length === 0 ? <p>No results found.</p> : null}
      </section>
    </SiteShell>
  );
}
