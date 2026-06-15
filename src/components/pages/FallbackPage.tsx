import Link from "next/link";
import type { ContentView } from "@/lib/content/types";

export async function FallbackPage({ record }: { record: ContentView }) {
  const { language } = record;

  return (
    <article className="content-page content-fallback">
        <section className="page-hero">
          <div className="site-container hero-inner">
            <p className="breadcrumb">
              <Link href={language === "th" ? "/" : "/en"}>
                {language === "th" ? "หน้าแรก" : "Home"}
              </Link>
              <span> / {record.title}</span>
            </p>
            <h1>{record.title}</h1>
          </div>
        </section>

        <div className="site-container content-layout" id="main-content">
          <div className="content-main">
            {record.excerpt ? <p className="page-excerpt">{record.excerpt}</p> : null}
          </div>
        </div>
    </article>
  );
}
