import Link from "next/link";
import Image from "next/image";
import type { HomeData } from "@/lib/db/page-data";
import type { WpLanguage } from "@/lib/wp/types";
import { ArticleCard } from "../article-card";
import { EventsCalendar } from "./events-calendar";

const TEXT = {
  th: {
    news: "ข่าวและกิจกรรมล่าสุด",
    newsAll: "ดูทั้งหมด",
    articles: "บทความล่าสุด",
    calendar: "ปฏิทินกิจกรรม",
    partners: "เครือข่ายพันธมิตร",
  },
  en: {
    news: "News and Activities",
    newsAll: "View all",
    articles: "Recent Articles",
    calendar: "RTRDA Calendar",
    partners: "Our Partners",
  },
} as const satisfies Record<WpLanguage, Record<string, string>>;

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div className="section-heading-row">
      <h2 id={id}>{children}</h2>
    </div>
  );
}

export function HomeSections({
  home,
  language,
}: {
  home: HomeData;
  language: WpLanguage;
}) {
  const t = TEXT[language];
  const newsPath = language === "th" ? "/ข่าวสาร-กิจกรรม" : "/en/ข่าวสาร-กิจกรรม";

  return (
    <div className="home-sections">
      <section className="home-section" aria-labelledby="home-news-title">
        <div className="section-heading-row">
          <h2 id="home-news-title">{t.news}</h2>
          <Link href={newsPath} className="section-all-link">
            {t.newsAll}
            <span aria-hidden="true" className="section-all-arrow" />
          </Link>
        </div>
        <div className="related-grid">
          {home.news.map((card) => (
            <ArticleCard key={card.record.id} card={card} />
          ))}
        </div>
      </section>

      <div className="home-split">
        <section className="home-section" aria-labelledby="home-articles-title">
          <SectionHeading id="home-articles-title">{t.articles}</SectionHeading>
          <div className="article-list">
            {home.articles.map((card) => (
              <ArticleCard key={card.record.id} card={card} />
            ))}
          </div>
        </section>

        <section className="home-section" aria-labelledby="home-calendar-title">
          <SectionHeading id="home-calendar-title">{t.calendar}</SectionHeading>
          <EventsCalendar days={home.calendarDays} language={language} />
        </section>
      </div>

      {home.partners.length > 0 ? (
        <section className="home-section" aria-labelledby="home-partners-title">
          <div className="section-heading-row section-heading-center">
            <h2 id="home-partners-title">{t.partners}</h2>
          </div>
          <div className="partners-strip">
            {home.partners.map((src) => (
              <span key={src} className="partner-logo">
                <Image src={src} alt="" width={160} height={90} />
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
