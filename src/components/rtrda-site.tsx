import Link from "next/link";
import Image from "next/image";
import type { WpContentRecord, WpImportManifest, WpLanguage } from "@/lib/wp/types";
import { findContentByPath, getNavigationTree } from "@/lib/wp/content-store";

const primaryNav = {
  th: [
    { label: "หน้าแรก", path: "/" },
    { label: "เกี่ยวกับ สทร.", path: "/เกี่ยวกับ-สทร" },
    { label: "ผลงานและโครงการเด่น", path: "/ผลงานและโครงการเด่น" },
    { label: "ข่าวสาร - กิจกรรม", path: "/ข่าวสาร-กิจกรรม" },
    { label: "เอกสารเผยแพร่", path: "/เอกสารเผยแพร่" },
    { label: "จัดซื้อจัดจ้าง", path: "/จัดซื้อจัดจ้าง" },
    { label: "ติดต่อเรา", path: "/ติดต่อเรา" },
  ],
  en: [
    { label: "Home", path: "/en" },
    { label: "About RTRDA", path: "/en/เกี่ยวกับ-สทร" },
    { label: "Our Projects", path: "/en/ผลงานและโครงการเด่น" },
    { label: "News & Activities", path: "/en/ข่าวสาร-กิจกรรม" },
    { label: "Publications", path: "/en/เอกสารเผยแพร่" },
    { label: "Procurement", path: "/en/จัดซื้อจัดจ้าง" },
    { label: "Contact", path: "/en/ติดต่อเรา" },
  ],
};

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
  const generatedDate = formatDate(manifest.generatedAt, language);
  const alternate = counterpartPath(manifest, path, language);
  const navigationTree = getNavigationTree(manifest.records, language).slice(0, 8);

  return (
    <div className="site-shell">
      <div className="utility-bar">
        <div className="site-container utility-inner">
          <span>
            {language === "th"
              ? "สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน)"
              : "Rail Technology Research and Development Agency"}
          </span>
          <nav aria-label="Utility navigation">
            <Link href="/แผนที่เว็บไซต์">{language === "th" ? "แผนที่เว็บไซต์" : "Sitemap"}</Link>
            <Link href={alternate}>{language === "th" ? "EN" : "TH"}</Link>
          </nav>
        </div>
      </div>

      <header className="site-header">
        <div className="site-container header-inner">
          <Link href={language === "th" ? "/" : "/en"} className="brand-link">
            <Image
              src="/wp-content/uploads/2023/02/Logo_RTRDA_full-1.png"
              alt="RTRDA"
              width={260}
              height={72}
              priority
            />
          </Link>
          <form action="/search" className="site-search">
            <input
              name="q"
              type="search"
              placeholder={language === "th" ? "ค้นหา" : "Search"}
              aria-label={language === "th" ? "ค้นหา" : "Search"}
            />
            <button type="submit">{language === "th" ? "ค้นหา" : "Search"}</button>
          </form>
        </div>
        <nav className="primary-nav" aria-label="Primary navigation">
          <div className="site-container nav-scroll">
            {primaryNav[language].map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={path === item.path ? "active" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main>{children}</main>

      <footer className="site-footer">
        <div className="site-container footer-grid">
          <section>
            <h2>{language === "th" ? "สทร." : "RTRDA"}</h2>
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
            <h2>{language === "th" ? "เมนูหลัก" : "Main links"}</h2>
            <ul>
              {navigationTree.map((item) => (
                <li key={item.path}>
                  <Link href={item.path}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2>{language === "th" ? "ติดต่อ" : "Contact"}</h2>
            <p>เลขที่ 99 กระทรวงคมนาคม ถนนราชดำเนินนอก แขวงวัดโสมนัส เขตป้อมปราบศัตรูพ่าย กรุงเทพฯ</p>
            <p>
              <a href="https://www.rtrda.or.th" rel="noreferrer">
                www.rtrda.or.th
              </a>
            </p>
          </section>
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
  const latest = record.path === "/" || record.path === "/en" ? latestPosts(manifest, record.language) : [];
  const dateText = formatDate(record.date, record.language);

  return (
    <SiteShell manifest={manifest} path={record.path}>
      <article className={`content-page content-${record.kind}`}>
        <div className="page-hero">
          <div className="site-container">
            <p className="breadcrumb">
              <Link href={record.language === "th" ? "/" : "/en"}>
                {record.language === "th" ? "หน้าแรก" : "Home"}
              </Link>
              {record.path !== "/" && record.path !== "/en" ? <span> / {record.title}</span> : null}
            </p>
            <h1>{record.title}</h1>
            {record.kind === "post" && dateText ? <time dateTime={record.date}>{dateText}</time> : null}
            {record.excerpt ? <p className="hero-excerpt">{record.excerpt}</p> : null}
          </div>
        </div>

        <div className="site-container content-layout">
          <div className="wp-content" dangerouslySetInnerHTML={{ __html: record.contentHtml }} />

          {children.length > 0 ? (
            <section className="related-section" aria-labelledby="related-pages-title">
              <h2 id="related-pages-title">
                {record.language === "th" ? "เนื้อหาที่เกี่ยวข้อง" : "Related pages"}
              </h2>
              <div className="related-grid">
                {children.map((child) => (
                  <Link key={child.id} href={child.path} className="related-card">
                    <span>{child.title}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {latest.length > 0 ? (
            <section className="latest-section" aria-labelledby="latest-posts-title">
              <h2 id="latest-posts-title">
                {record.language === "th" ? "ข่าวล่าสุด" : "Latest news"}
              </h2>
              <div className="news-list">
                {latest.map((post) => (
                  <Link key={post.id} href={post.path} className="news-card">
                    <time dateTime={post.date}>{formatDate(post.date, post.language)}</time>
                    <span>{post.title}</span>
                    {post.excerpt ? <p>{post.excerpt}</p> : null}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
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
        <div className="site-container">
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
        <div className="news-list">
          {results.map((record) => (
            <Link key={record.id} href={record.path} className="news-card">
              <span>{record.title}</span>
              <p>{record.path}</p>
            </Link>
          ))}
        </div>
        {normalizedQuery && results.length === 0 ? <p>No results found.</p> : null}
      </section>
    </SiteShell>
  );
}
