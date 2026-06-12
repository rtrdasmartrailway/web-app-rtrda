import Link from "next/link";
import type { WpContentRecord } from "@/lib/wp/types";
import { getNewsBySlug } from "@/db/queries";
import { SiteShell, formatDate } from "@/components/rtrda-shared";

export async function PostPage({ record }: { record: WpContentRecord }) {
  const { language } = record;
  const dateText = formatDate(record.date, language);

  const newsItem = await getNewsBySlug(record.path.slice(1));

  return (
    <SiteShell path={record.path}>
      <article className="content-page content-post">
        <section className="page-hero">
          <div className="site-container hero-inner">
            <p className="breadcrumb">
              <Link href={language === "th" ? "/" : "/en"}>
                {language === "th" ? "หน้าแรก" : "Home"}
              </Link>
              <span> / {record.title}</span>
            </p>
            <h1>{record.title}</h1>
            {dateText ? <time dateTime={record.date}>{dateText}</time> : null}
            {record.excerpt ? <p className="hero-excerpt">{record.excerpt}</p> : null}
          </div>
        </section>

        <div className="site-container content-layout" id="main-content">
          <div className="content-main">
            {newsItem?.body ? (
              <div
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: newsItem.body }}
              />
            ) : record.excerpt ? (
              <p className="post-excerpt">{record.excerpt}</p>
            ) : null}
          </div>
        </div>
      </article>
    </SiteShell>
  );
}
