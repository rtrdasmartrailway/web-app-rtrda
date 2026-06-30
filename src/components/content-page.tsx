import Link from "next/link";
import type { PageData } from "@/lib/db/page-data";
import { isRailStandardsPath } from "@/lib/wp/high-speed-rail-standards";
import type { PresentationSidebarItem } from "@/lib/wp/presentation";
import { ArticleCard } from "./article-card";
import { BoardExecutiveContent } from "./board-executive-org-chart";
import { CategoryNewsListing } from "./category-news-listing";
import { CategoryPagination } from "./category-pagination";
import { HighSpeedRailStandardsContent } from "./high-speed-rail-standards";
import { HomeHeroSlider } from "./home-hero-slider";
import { HomeSections } from "./home/home-sections";
import { KnowledgeDocuments } from "./knowledge-documents";
import { PdfReader } from "./pdf-reader";
import { SiteShell } from "./site-shell";
import { YutthLightbox } from "./yutth-lightbox";
import { WpImageFallback } from "./wp-image-fallback";
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
        {items.map((item) => {
          const content = (
            <>
              <span>{item.label}</span>
              <span aria-hidden="true" className="sidebar-arrow" />
            </>
          );

          return item.external ? (
            <a
              key={`${item.href}-${item.label}`}
              href={item.href}
              rel="noreferrer"
              target="_blank"
            >
              {content}
            </a>
          ) : (
            <Link
              key={item.path ?? item.href}
              href={item.href}
              className={item.active ? "active" : undefined}
              aria-current={item.active ? "page" : undefined}
            >
              {content}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function normalizeWpContentHtml(html: string): string {
  return html.replace(
    /(banner-ช่องทางแจ้งเรื่องร้องเรียน-01-(?:1024x323|300x95|768x243|1536x485|2048x647|18x6)\.jpg)(?![?\w-])/g,
    "$1?v=20260630",
  );
}

export function contentRouteClass(path: string): string {
  const canonicalPath = path.replace(/^\/en(?=\/)/, "");

  if (canonicalPath === "/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร") {
    return "content-board-executives";
  }

  if (isRailStandardsPath(canonicalPath)) {
    return "content-rail-standards";
  }

  return "";
}

export function ContentPage({ data }: { data: PageData }) {
  const {
    record,
    children,
    latest,
    newsCards,
    categoryPagination,
    sidebarItems,
    parentTitle,
  } = data;
  const isHome = record.path === "/" || record.path === "/en";
  const isCategory = record.kind === "category";
  const dateText = formatDate(record.date, record.language);
  const routeClass = contentRouteClass(record.path);
  const pageClassName = [
    "content-page",
    `content-${record.kind}`,
    isHome ? "content-home" : "",
    routeClass,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <SiteShell shell={data.shell}>
      <article className={pageClassName}>
        <section className={`page-hero ${isHome ? "home-hero" : ""}`}>
          {isHome ? <HomeHeroSlider /> : null}
          {!isHome ? (
            <div className="site-container hero-inner">
              <p className="breadcrumb">
                <Link href={record.language === "th" ? "/" : "/en"}>
                  {record.language === "th" ? "หน้าแรก" : "Home"}
                </Link>
                <span> / {record.title}</span>
              </p>
              <h1>{record.title}</h1>
              {record.kind === "post" && dateText ? (
                <time dateTime={record.date}>{dateText}</time>
              ) : null}
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
                {categoryPagination && categoryPagination.totalPages > 1 ? (
                  <CategoryPagination pagination={categoryPagination} />
                ) : null}
              </>
            ) : isHome && data.home ? (
              <HomeSections home={data.home} language={record.language} />
            ) : isRailStandardsPath(record.path) ? (
              <HighSpeedRailStandardsContent html={record.contentHtml} />
            ) : data.knowledgeDocuments ? (
              <KnowledgeDocuments
                groups={data.knowledgeDocuments}
                language={record.language}
              />
            ) : data.boardExecutivePresentation ? (
              <BoardExecutiveContent presentation={data.boardExecutivePresentation} />
            ) : (
              <div
                className="wp-content"
                dangerouslySetInnerHTML={{
                  __html: normalizeWpContentHtml(record.contentHtml),
                }}
              />
            )}
            <YutthLightbox />
            <PdfReader targets={data.pdfReaderTargets} language={record.language} />
            <WpImageFallback />

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
