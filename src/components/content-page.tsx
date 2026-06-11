import Link from "next/link";
import type { WpContentRecord, WpImportManifest } from "@/lib/wp/types";
import { getSidebarItems, type PresentationSidebarItem } from "@/lib/wp/presentation";
import { ArticleCard } from "./article-card";
import { SiteShell } from "./site-shell";
import {
  formatDate,
  hasImportedLatestPosts,
  latestPosts,
  parentTitle,
  relatedChildren,
} from "./site-helpers";

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

export function ContentPage({
  manifest,
  record,
}: {
  manifest: WpImportManifest;
  record: WpContentRecord;
}) {
  const children = relatedChildren(manifest, record);
  const isHome = record.path === "/" || record.path === "/en";
  const latest =
    isHome && !hasImportedLatestPosts(record)
      ? latestPosts(manifest, record.language)
      : [];
  const dateText = formatDate(record.date, record.language);
  const sidebarItems =
    record.kind === "page" ? getSidebarItems(manifest.records, record) : [];
  const sidebarTitle = parentTitle(manifest, record);

  return (
    <SiteShell manifest={manifest} path={record.path}>
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
            <div
              className="wp-content"
              dangerouslySetInnerHTML={{ __html: record.contentHtml }}
            />

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
