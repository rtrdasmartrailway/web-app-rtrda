import Link from "next/link";
import type { ContentView } from "@/lib/content/types";

export async function FlipbookPage({ record }: { record: ContentView }) {
  const { language } = record;

  return (
    <article className="content-page content-flipbook">
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
            <div className="flipbook-card">
              <a
                href={record.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="wp-block-button__link"
              >
                {language === "th" ? "เปิดเอกสารเผยแพร่ต้นฉบับ" : "Open original document"}
              </a>
            </div>
          </div>
        </div>
    </article>
  );
}
