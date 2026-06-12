import Link from "next/link";
import type { WpContentRecord } from "@/lib/wp/types";
import { getChildPages, getLatestPosts } from "@/db/queries";
import { ArticleCard, SiteShell } from "@/components/rtrda-shared";

export async function HomePage({ record }: { record: WpContentRecord }) {
  const { language } = record;

  const [children, latest] = await Promise.all([
    getChildPages(record.path),
    getLatestPosts(language, 6),
  ]);

  return (
    <SiteShell path={record.path}>
      <article className="content-page content-home">
        <section className="page-hero home-hero">
          <div className="site-container hero-inner">
            <p className="breadcrumb">
              <Link href={language === "th" ? "/" : "/en"}>
                {language === "th" ? "หน้าแรก" : "Home"}
              </Link>
            </p>
            <h1>{record.title}</h1>
            {record.excerpt ? <p className="hero-excerpt">{record.excerpt}</p> : null}
            <a className="hero-button" href="#main-content">
              {language === "th" ? "ดูข้อมูลล่าสุด" : "Explore Content"}
              <span aria-hidden="true" />
            </a>
          </div>
        </section>

        <div className="site-container content-layout" id="main-content">
          <div className="content-main">
            {children.length > 0 ? (
              <section className="related-section" aria-labelledby="home-related-title">
                <div className="section-heading-row">
                  <h2 id="home-related-title">
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
              <section className="latest-section" aria-labelledby="home-latest-title">
                <div className="section-heading-row">
                  <h2 id="home-latest-title">
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
