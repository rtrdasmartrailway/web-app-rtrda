import Link from "next/link";
import type { WpContentRecord } from "@/lib/wp/types";
import { getChildPages } from "@/db/queries";
import { ArticleCard, SiteShell } from "@/components/rtrda-shared";

export async function CategoryPage({ record }: { record: WpContentRecord }) {
  const { language } = record;
  const posts = await getChildPages(record.path);

  return (
    <SiteShell path={record.path}>
      <article className="content-page content-category">
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

        <div className="site-container content-layout" id="main-content">
          <div className="content-main">
            {posts.length > 0 ? (
              <div className="related-grid">
                {posts.map((post) => (
                  <ArticleCard key={post.id} record={post} />
                ))}
              </div>
            ) : (
              <p>{language === "th" ? "ยังไม่มีเนื้อหาในหมวดหมู่นี้" : "No content in this category yet."}</p>
            )}
          </div>
        </div>
      </article>
    </SiteShell>
  );
}
