import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import type { ContentView } from "@/lib/content/types";
import { getChildPages, listNews, type NewsRow } from "@/db/queries";
import { getCategoryByPath } from "@/lib/content/categories";
import { pickLang, displayPath } from "@/lib/content/i18n";
import type { WpLanguage } from "@/lib/wp/types";
import { ArticleCard, formatDate } from "@/components/rtrda-shared";
import { CategoryGridSkeleton } from "@/components/skeletons";

function NewsCard({ item, language }: { item: NewsRow; language: WpLanguage }) {
  const dateStr = item.publishedAt?.toISOString() ?? "";
  const dateText = formatDate(dateStr, language);
  const title = pickLang(item.titleTh, item.titleEn, language);
  const excerpt = pickLang(item.excerptTh, item.excerptEn, language);
  const href = displayPath(`/${item.slug}`, language);

  return (
    <article className="bg-white border border-[#c3c6d2] overflow-hidden group">
      <div className="relative h-48 overflow-hidden">
        <Image
          src="/stitch-assets/page-hero.png"
          alt=""
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {item.category && (
          <span className="absolute top-3 left-3 bg-[#0055c7] text-white text-[11px] font-bold px-2 py-1 tracking-wide">
            {item.category}
          </span>
        )}
      </div>
      <div className="p-4">
        {dateText && (
          <div className="flex items-center gap-1.5 text-xs text-[#44474f] mb-2">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>calendar_today</span>
            <time dateTime={dateStr}>{dateText}</time>
          </div>
        )}
        <h3 className="text-[15px] font-bold text-[#001f49] mb-2 line-clamp-2 leading-snug">
          {title}
        </h3>
        {excerpt && (
          <p className="text-sm text-[#44474f] line-clamp-3 mb-3 leading-relaxed">
            {excerpt}
          </p>
        )}
        <Link
          href={href}
          className="flex items-center gap-1 text-sm font-bold text-[#0055c7] hover:underline"
        >
          {language === "th" ? "อ่านต่อ" : "Read more"}
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
        </Link>
      </div>
    </article>
  );
}

/** Data region — news category grid, or the child-pages fallback grid. */
async function CategoryGrid({ record }: { record: ContentView }) {
  const { language } = record;
  const newsCategory = getCategoryByPath(record.path)?.newsCategory ?? null;

  if (newsCategory) {
    const newsItems = await listNews({ category: newsCategory, limit: 20 });
    if (newsItems.length === 0) {
      return <p>{language === "th" ? "ยังไม่มีเนื้อหาในหมวดหมู่นี้" : "No content in this category yet."}</p>;
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {newsItems.map((item) => (
          <NewsCard key={item.id} item={item} language={language} />
        ))}
      </div>
    );
  }

  const posts = await getChildPages(record.path);
  if (posts.length === 0) {
    return <p>{language === "th" ? "ยังไม่มีเนื้อหาในหมวดหมู่นี้" : "No content in this category yet."}</p>;
  }
  return (
    <div className="related-grid">
      {posts.map((post) => (
        <ArticleCard key={post.id} record={post} />
      ))}
    </div>
  );
}

export function CategoryPage({ record }: { record: ContentView }) {
  const { language } = record;

  return (
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
            <Suspense fallback={<CategoryGridSkeleton />}>
              <CategoryGrid record={record} />
            </Suspense>
          </div>
        </div>
    </article>
  );
}
