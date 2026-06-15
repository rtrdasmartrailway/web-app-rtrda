import Link from "next/link";
import type { ContentView } from "@/lib/content/types";
import { formatDate } from "@/components/rtrda-shared";

/** Article body — carried on the resolved view. */
function PostBody({ record }: { record: ContentView }) {
  if (record.body) {
    return <div className="prose max-w-none whitespace-pre-wrap">{record.body}</div>;
  }
  if (record.excerpt) {
    return <p className="post-excerpt">{record.excerpt}</p>;
  }
  return null;
}

export function PostPage({ record }: { record: ContentView }) {
  const { language } = record;
  const dateText = formatDate(record.date, language);

  return (
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
            <PostBody record={record} />
          </div>
        </div>
    </article>
  );
}
