import Link from "next/link";
import type { PageData } from "@/lib/db/page-data";
import type { PresentationSidebarItem } from "@/lib/wp/presentation";
import { ArticleCard } from "./article-card";
import { CategoryNewsListing } from "./category-news-listing";
import { HomeSections } from "./home/home-sections";
import { SiteShell } from "./site-shell";
import { YutthLightbox } from "./yutth-lightbox";
import { formatDate } from "./site-helpers";

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
          <Link
            key={item.path}
            href={item.path}
            className={item.active ? "active" : undefined}
          >
            <span>{item.label}</span>
            <span aria-hidden="true" className="sidebar-arrow" />
          </Link>
        ))}
      </nav>
    </aside>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="stat-card">
      <span className="stat-number">{value.toLocaleString()}+</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export function ContentPage({ data }: { data: PageData }) {
  const { record, children, latest, newsCards, sidebarItems, parentTitle } = data;
  const isHome = record.path === "/" || record.path === "/en";
  const isCategory = record.kind === "category";
  const dateText = formatDate(record.date, record.language);

  return (
    <SiteShell shell={data.shell}>
      <article
        className={`content-page content-${record.kind} ${isHome ? "content-home" : ""}`}
      >
        <section className={`page-hero ${isHome ? "home-hero" : ""}`}>
          <div className="site-container hero-inner">
            <p className="breadcrumb">
              <Link href={record.language === "th" ? "/" : "/en"}>
                {record.language === "th" ? "หน้าแรก" : "Home"}
              </Link>
              {!isHome ? <span> / {record.title}</span> : null}
            </p>
            <h1>{record.title}</h1>
            {record.kind === "post" && dateText ? (
              <time dateTime={record.date}>{dateText}</time>
            ) : null}
            {record.excerpt ? <p className="hero-excerpt">{record.excerpt}</p> : null}
            {isHome ? (
              <>
                <form
                  action="/search"
                  className="home-search"
                  role="search"
                  aria-label={
                    record.language === "th" ? "ค้นหางานวิจัย" : "Search research"
                  }
                >
                  <input
                    name="q"
                    type="search"
                    placeholder={
                      record.language === "th"
                        ? "ค้นหางานวิจัย เอกสาร และข่าวสาร…"
                        : "Search research, documents and news…"
                    }
                    aria-label={record.language === "th" ? "ค้นหา" : "Search"}
                  />
                  {record.language === "en" ? (
                    <input type="hidden" name="lang" value="en" />
                  ) : null}
                  <button type="submit">
                    {record.language === "th" ? "ค้นหา" : "Search"}
                  </button>
                </form>
                <div className="hero-cta-row">
                  <a className="hero-button" href="#main-content">
                    {record.language === "th" ? "ดูข้อมูลล่าสุด" : "Explore Content"}
                    <span aria-hidden="true" />
                  </a>
                  <Link
                    className="hero-button secondary"
                    href={
                      record.language === "th" ? "/เอกสารเผยแพร่" : "/en/เอกสารเผยแพร่"
                    }
                  >
                    {record.language === "th" ? "เอกสารเผยแพร่" : "Publications"}
                    <span aria-hidden="true" />
                  </Link>
                </div>
              </>
            ) : null}
          </div>
          {isHome && data.stats ? (
            <div className="stats-band">
              <div className="site-container stats-grid">
                <StatCard
                  value={data.stats.posts}
                  label={
                    record.language === "th" ? "ข่าวสารและบทความ" : "News & articles"
                  }
                />
                <StatCard
                  value={data.stats.pages}
                  label={record.language === "th" ? "หน้าข้อมูล" : "Information pages"}
                />
                <StatCard
                  value={data.stats.flipbooks}
                  label={record.language === "th" ? "สิ่งพิมพ์/เอกสาร" : "Publications"}
                />
                <StatCard
                  value={data.stats.downloads}
                  label={
                    record.language === "th" ? "ไฟล์ดาวน์โหลด" : "Downloadable files"
                  }
                />
              </div>
            </div>
          ) : null}
        </section>

        <div
          className={`site-container content-layout ${sidebarItems.length > 0 ? "with-sidebar" : ""}`}
          id="main-content"
        >
          <SideNavigation items={sidebarItems} title={parentTitle} />

          <div className="content-main">
            {isCategory && newsCards.length > 0 ? (
              <>
                <CategoryNewsListing cards={newsCards} />
                <nav className="category-pagination">
                  <Link
                    href={`${record.path === "/" ? "" : record.path}/page/2`}
                    rel="next"
                  >
                    {record.language === "th" ? "หน้าถัดไป →" : "Next page →"}
                  </Link>
                </nav>
              </>
            ) : isHome && data.home ? (
              <HomeSections home={data.home} language={record.language} />
            ) : (
              <div
                className="wp-content"
                dangerouslySetInnerHTML={{ __html: record.contentHtml }}
              />
            )}
            <YutthLightbox />

            {/* Category listings already show their own news cards; skip related. */}
            {!isCategory && children.length > 0 ? (
              <section className="related-section" aria-labelledby="related-pages-title">
                <div className="section-heading-row">
                  <h2 id="related-pages-title">
                    {record.language === "th" ? "เนื้อหาที่เกี่ยวข้อง" : "Related pages"}
                  </h2>
                </div>
                <div className="related-grid">
                  {children.map((child) => (
                    <ArticleCard key={child.record.id} card={child} />
                  ))}
                </div>
              </section>
            ) : null}

            {!isCategory && latest.length > 0 ? (
              <section className="latest-section" aria-labelledby="latest-posts-title">
                <div className="section-heading-row">
                  <h2 id="latest-posts-title">
                    {record.language === "th" ? "ข่าวล่าสุด" : "Latest news"}
                  </h2>
                </div>
                <div className="related-grid">
                  {latest.map((post) => (
                    <ArticleCard key={post.record.id} card={post} />
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
