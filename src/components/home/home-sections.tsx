import Link from "next/link";
import Image from "next/image";
import type { HomeData } from "@/lib/db/page-data";
import { supplementalKnowledgePages } from "@/lib/wp/knowledge-supplemental-documents";
import { landingGuidePages } from "@/lib/wp/landing-guide-pages";
import type { WpLanguage } from "@/lib/wp/types";
import { ArticleCard } from "../article-card";
import { EventsCalendar } from "./events-calendar";

const TEXT = {
  th: {
    news: "ข่าวและกิจกรรมล่าสุด",
    newsAll: "ดูทั้งหมด",
    articles: "บทความล่าสุด",
    calendar: "ปฏิทินกิจกรรม",
    serviceBanners: "บริการและข้อมูลสำคัญ",
    partners: "เครือข่ายพันธมิตร",
  },
  en: {
    news: "News and Activities",
    newsAll: "View all",
    articles: "Recent Articles",
    calendar: "RTRDA Calendar",
    serviceBanners: "Key Services and Information",
    partners: "Our Partners",
  },
} as const satisfies Record<WpLanguage, Record<string, string>>;

const SERVICE_BANNERS = [
  {
    icon: "↗",
    titleTh: "ศูนย์รวมข้อมูลงานระบบราง",
    titleEn: "Rail Knowledge Center",
    subtitleTh: "ข้อมูลอ้างอิงและบริการกลางของ สทร.",
    subtitleEn: "RTRDA reference information and services",
    href: "https://nrail.rtrda.or.th/",
    tone: "slate",
  },
  {
    icon: "📄",
    titleTh: "เอกสารเผยแพร่และรายงาน",
    titleEn: "Public Reports",
    subtitleTh: "รายงาน แผนงาน และเอกสารเปิดเผยต่อสาธารณะ",
    subtitleEn: "Reports, plans, and public documents",
    href: "https://test.rtrda.or.th/e-services",
    tone: "silver",
  },
  {
    icon: "⚖",
    titleTh: "ธรรมาภิบาลและความโปร่งใส",
    titleEn: "Governance & Transparency",
    subtitleTh: "ข้อมูล ITA นโยบาย และมาตรการกำกับดูแล",
    subtitleEn: "ITA, policy, and governance information",
    href: "https://test.rtrda.or.th/%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B9%80%E0%B8%A1%E0%B8%B4%E0%B8%99%E0%B8%84%E0%B8%B8%E0%B8%93%E0%B8%98%E0%B8%A3%E0%B8%A3%E0%B8%A1%E0%B9%81%E0%B8%A5%E0%B8%B0%E0%B8%84%E0%B8%A7",
    tone: "dark",
  },
  {
    icon: "🚆",
    titleTh: "โครงการวิจัยระบบราง",
    titleEn: "Rail Research Projects",
    subtitleTh: "โครงการเด่น งานวิจัย และการถ่ายทอดเทคโนโลยี",
    subtitleEn: "Research, highlights, and technology transfer",
    href: "https://test.rtrda.or.th/%E0%B8%84%E0%B8%A5%E0%B8%B1%E0%B8%87%E0%B8%84%E0%B8%A7%E0%B8%B2%E0%B8%A1%E0%B8%A3%E0%B8%B9%E0%B9%89",
    tone: "rail",
  },
  {
    icon: "📢",
    titleTh: "ข่าวประชาสัมพันธ์",
    titleEn: "Public Relations",
    subtitleTh: "ข่าวกิจกรรมและประกาศสำคัญจาก สทร.",
    subtitleEn: "News, activities, and announcements",
    href: "https://test.rtrda.or.th/category/%E0%B8%82%E0%B9%88%E0%B8%B2%E0%B8%A7%E0%B9%81%E0%B8%A5%E0%B8%B0%E0%B8%81%E0%B8%B4%E0%B8%88%E0%B8%81%E0%B8%A3%E0%B8%A3%E0%B8%A1",
    tone: "paper",
  },
  {
    icon: "🔎",
    titleTh: "จัดซื้อจัดจ้าง",
    titleEn: "Procurement",
    subtitleTh: "แผนประกาศ TOR และผลผู้ชนะการเสนอราคา",
    subtitleEn: "Plans, TOR, and winner announcements",
    href: "https://test.rtrda.or.th/%E0%B8%88%E0%B8%B1%E0%B8%94%E0%B8%8B%E0%B8%B7%E0%B9%89%E0%B8%AD%E0%B8%88%E0%B8%B1%E0%B8%94%E0%B8%88%E0%B9%89%E0%B8%B2%E0%B8%87/%E0%B9%81%E0%B8%9C%E0%B8%99%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%88%E0%B8%B1%E0%B8%94%E0%B8%8B%E0%B8%B7%E0%B9%89%E0%B8%AD%E0%B8%88%E0%B8%B1%E0%B8%94%E0%B8%88%E0%B9%89%E0%B8%B2%E0%B8%87",
    tone: "charcoal",
  },
] as const;

const DOCUMENT_BANNER_PAGES = [
  ...supplementalKnowledgePages,
  ...landingGuidePages,
] as const;

function getDocumentCount(page: (typeof DOCUMENT_BANNER_PAGES)[number]): number {
  if ("groups" in page) {
    return page.groups.reduce((sum, group) => sum + group.documents.length, 0);
  }

  return page.group.documents.length;
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div className="section-heading-row">
      <h2 id={id}>{children}</h2>
    </div>
  );
}

function HomeServiceBannerMockup({ language }: { language: WpLanguage }) {
  return (
    <section
      className="home-section home-service-banners"
      aria-labelledby="home-service-banners-title"
    >
      <div className="section-heading-row section-heading-center home-service-banners-head">
        <h2 id="home-service-banners-title">{TEXT[language].serviceBanners}</h2>
      </div>
      <div className="service-banner-grid" aria-label={TEXT[language].serviceBanners}>
        {SERVICE_BANNERS.map((banner) => (
          <a
            aria-label={language === "th" ? banner.titleTh : banner.titleEn}
            className={`service-banner-card service-banner-card-${banner.tone}`}
            href={banner.href}
            key={banner.titleTh}
          >
            <span className="service-banner-icon" aria-hidden="true">
              {banner.icon}
            </span>
            <span className="service-banner-copy">
              <strong>{language === "th" ? banner.titleTh : banner.titleEn}</strong>
              <small>{language === "th" ? banner.subtitleTh : banner.subtitleEn}</small>
            </span>
            <span className="service-banner-arrow" aria-hidden="true" />
          </a>
        ))}
      </div>

      <div className="home-service-documents" aria-label="เอกสารบริการและข้อมูลสำคัญ">
        <p className="home-service-documents-eyebrow">เอกสารบริการและข้อมูลสำคัญ</p>
        <div className="service-banner-grid service-banner-grid-documents">
          {DOCUMENT_BANNER_PAGES.map((page, index) => {
            const documentCount = getDocumentCount(page);

            return (
              <a
                aria-label={`เปิดเอกสาร: ${page.title}`}
                className={`service-banner-card service-banner-card-${index % 2 === 0 ? "dark" : "slate"}`}
                href={page.path}
                key={page.slug}
              >
                <span
                  className="service-banner-icon service-banner-icon-pdf"
                  aria-hidden="true"
                >
                  PDF
                </span>
                <span className="service-banner-copy">
                  <strong>{page.title}</strong>
                  <small>{documentCount} ไฟล์ • จัดรูปแบบแสดงผลแบบคลังความรู้</small>
                </span>
                <span className="service-banner-arrow" aria-hidden="true" />
              </a>
            );
          })}
        </div>
      </div>
    </section>
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
          {home.news.slice(0, 4).map((card) => (
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

      <HomeServiceBannerMockup language={language} />

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
