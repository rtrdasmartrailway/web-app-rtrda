import Link from "next/link";
import type { WpContentRecord } from "@/lib/wp/types";
import { getChildPages, getContentByPath } from "@/db/queries";
import { getSidebarItems } from "@/lib/wp/presentation";
import { ArticleCard, SideNavigation, SiteShell } from "@/components/rtrda-shared";

export async function StandardPage({ record }: { record: WpContentRecord }) {
  const { language } = record;

  const [children, siblingCandidates, parentRecord] = await Promise.all([
    getChildPages(record.path),
    record.parentPath ? getChildPages(record.parentPath) : Promise.resolve([]),
    record.parentPath ? getContentByPath(record.parentPath) : Promise.resolve(null),
  ]);

  const sidebarPool = children.length > 0 ? children : siblingCandidates;
  const sidebarItems = getSidebarItems(sidebarPool, record);
  const sidebarTitle = parentRecord?.title ?? record.title;

  return (
    <SiteShell path={record.path}>
      <article className="content-page content-page">
        <section className="page-hero">
          <div className="site-container hero-inner">
            <p className="breadcrumb">
              <Link href={language === "th" ? "/" : "/en"}>
                {language === "th" ? "หน้าแรก" : "Home"}
              </Link>
              <span> / {record.title}</span>
            </p>
            <h1>{record.title}</h1>
            {record.excerpt ? <p className="hero-excerpt">{record.excerpt}</p> : null}
          </div>
        </section>

        <div
          className={`site-container content-layout ${sidebarItems.length > 0 ? "with-sidebar" : ""}`}
          id="main-content"
        >
          <SideNavigation items={sidebarItems} title={sidebarTitle} />
          <div className="content-main">
            {record.excerpt ? (
              <p className="page-excerpt">{record.excerpt}</p>
            ) : null}

            {children.length > 0 ? (
              <section className="related-section" aria-labelledby="standard-related-title">
                <div className="section-heading-row">
                  <h2 id="standard-related-title">
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
          </div>
        </div>
      </article>
    </SiteShell>
  );
}
