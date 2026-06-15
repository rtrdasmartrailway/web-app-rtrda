import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import type { WpLanguage } from "@/lib/wp/types";
import type { ContentView } from "@/lib/content/types";
import {
  listNews,
  listHeroSlides,
  listEvents,
  listPartners,
  type EventRow,
} from "@/db/queries";
import { formatDate } from "@/components/rtrda-shared";
import { pickLang, displayPath } from "@/lib/content/i18n";
import {
  HeroSkeleton,
  NewsHomeSkeleton,
  PartnersSkeleton,
} from "@/components/skeletons";
import { HeroSlider } from "./HeroSlider";

const FONT = { fontFamily: "'Hanken Grotesk', 'Noto Sans Thai', sans-serif" };

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function buildCalendarCells(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const thaiFirstDay = firstDay === 0 ? 6 : firstDay - 1;
  const cells: (number | null)[] = [];
  for (let i = 0; i < thaiFirstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CalendarWidget({ events }: { events: EventRow[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const cells = buildCalendarCells(year, month);
  const eventMap = new Map(
    events.map((e) => [new Date(e.eventDate + "T00:00:00").getDate(), e]),
  );

  return (
    <div className="bg-white border border-[#c3c6d2] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-[#001f49] text-sm">ปฏิทินกิจกรรม สวพร.</h3>
        <div className="flex gap-1">
          <button className="w-7 h-7 flex items-center justify-center border border-[#c3c6d2] text-[#001f49] hover:bg-[#eeeeee] transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
          </button>
          <button className="w-7 h-7 flex items-center justify-center border border-[#c3c6d2] text-[#001f49] hover:bg-[#eeeeee] transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
          </button>
        </div>
      </div>

      <p className="text-center text-sm font-semibold text-[#001f49] mb-3">
        {THAI_MONTHS[month]} {year + 543}
      </p>

      <div className="grid grid-cols-7 mb-1">
        {["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"].map((d) => (
          <div key={d} className="text-center text-[11px] font-bold text-[#44474f] py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="aspect-square" />;
          const event = eventMap.get(day);
          const isToday = day === today;

          let cls = "flex items-center justify-center text-[12px] aspect-square cursor-default";
          if (isToday) {
            cls += " rounded-full bg-[#0055c7] text-white font-bold";
          } else if (event) {
            cls += " rounded-full font-bold text-white";
          } else {
            cls += " text-[#1a1c1c] hover:bg-[#eeeeee]";
          }

          return (
            <div
              key={i}
              className={cls}
              style={event && !isToday ? { backgroundColor: event.colorHex } : undefined}
              title={event?.title}
            >
              {day}
            </div>
          );
        })}
      </div>

      {events.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {events.map((e) => (
            <div key={e.id} className="flex items-center gap-2 text-[12px] text-[#44474f]">
              <span
                className="w-3 h-3 flex-shrink-0 rounded-sm inline-block"
                style={{ backgroundColor: e.colorHex }}
              />
              {e.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Hero banner — fetches active slides. */
async function HeroSection({ language }: { language: WpLanguage }) {
  const slides = await listHeroSlides({ language, activeOnly: true });
  return (
    <HeroSlider
      slides={slides.map((s) => ({
        imageUrl: s.imagePath ?? "/stitch-assets/home-hero.png",
        alt: s.altText,
      }))}
    />
  );
}

/** News grid + latest articles + event calendar (one listNews fetch). */
async function NewsSection({ language }: { language: WpLanguage }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthFrom = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const monthTo = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const [newsItems, monthEvents] = await Promise.all([
    listNews({ limit: 5 }),
    listEvents({ language, from: monthFrom, to: monthTo }),
  ]);

  const newsPosts = newsItems.slice(0, 3);
  const articlePosts = newsItems.slice(3, 5);
  const newsHref = language === "th" ? "/ข่าวสาร-กิจกรรม" : "/en/ข่าวสาร-กิจกรรม";

  return (
    <>
      {/* ข่าวสารและกิจกรรม */}
      <section className="py-16 bg-white" style={FONT}>
        <div className="mx-auto max-w-[1280px] px-10">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-[#001f49] mb-2">
                {language === "th" ? "ข่าวสารและกิจกรรม" : "News & Activities"}
              </h2>
              <div className="w-16 h-1 bg-[#0055c7]" />
            </div>
            <Link
              href={newsHref}
              className="flex items-center gap-0.5 text-sm font-bold text-[#0055c7] hover:underline"
            >
              {language === "th" ? "ดูทั้งหมด" : "View all"}
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {newsPosts.map((item) => {
              const dateStr = item.publishedAt?.toISOString() ?? "";
              const dateText = formatDate(dateStr, language);
              const title = pickLang(item.titleTh, item.titleEn, language);
              const excerpt = pickLang(item.excerptTh, item.excerptEn, language);
              const href = displayPath(`/${item.slug}`, language);

              return (
                <article key={item.id} className="bg-white border border-[#c3c6d2] overflow-hidden group">
                  <div className="relative h-52 overflow-hidden">
                    <Image
                      src="/stitch-assets/page-hero.png"
                      alt=""
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                    {item.category && (
                      <span className="absolute top-3 left-3 bg-[#0055c7] text-white text-[11px] font-bold px-2 py-1 uppercase tracking-wide">
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
            })}
          </div>
        </div>
      </section>

      {/* บทความล่าสุด + ปฏิทิน */}
      <section className="py-16 bg-[#f3f3f3]" style={FONT}>
        <div className="mx-auto max-w-[1280px] px-10">
          <div className="flex gap-8 items-start flex-col lg:flex-row">
            {/* บทความล่าสุด */}
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-[#001f49] mb-2">
                {language === "th" ? "บทความล่าสุด" : "Latest Articles"}
              </h2>
              <div className="w-16 h-1 bg-[#0055c7] mb-6" />

              <div className="space-y-4">
                {articlePosts.map((item) => {
                  const dateStr = item.publishedAt?.toISOString() ?? "";
                  const dateText = formatDate(dateStr, language);
                  const title = pickLang(item.titleTh, item.titleEn, language);
                  const excerpt = pickLang(item.excerptTh, item.excerptEn, language);
                  const href = displayPath(`/${item.slug}`, language);

                  return (
                    <article key={item.id} className="bg-white border border-[#c3c6d2] p-4 flex gap-4 group">
                      <div className="flex-shrink-0 w-32 h-24 relative overflow-hidden">
                        <Image
                          src="/stitch-assets/page-hero.png"
                          alt=""
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="128px"
                        />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          {dateText && (
                            <p className="text-xs text-[#0055c7] font-bold mb-1">{dateText}</p>
                          )}
                          <h3 className="text-sm font-bold text-[#001f49] line-clamp-2 leading-snug mb-1">
                            {title}
                          </h3>
                          {excerpt && (
                            <p className="text-xs text-[#44474f] line-clamp-2 leading-relaxed">
                              {excerpt}
                            </p>
                          )}
                        </div>
                        <Link
                          href={href}
                          className="mt-2 inline-flex items-center text-xs font-bold text-[#001f49] border border-[#001f49] px-3 py-1.5 hover:bg-[#001f49] hover:text-white transition-colors self-start"
                        >
                          {language === "th" ? "อ่านต่อ" : "Read more"}
                        </Link>
                      </div>
                    </article>
                  );
                })}

                {articlePosts.length === 0 && (
                  <p className="text-sm text-[#44474f]">
                    {language === "th" ? "ยังไม่มีบทความ" : "No articles yet"}
                  </p>
                )}
              </div>
            </div>

            {/* ปฏิทินกิจกรรม */}
            <div className="w-full lg:w-72 flex-shrink-0">
              <CalendarWidget events={monthEvents} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/** Strategic partners logo row. */
async function PartnersSection({ language }: { language: WpLanguage }) {
  const partnerList = await listPartners();
  if (partnerList.length === 0) return null;

  return (
    <section className="py-16 bg-white border-t border-[#c3c6d2]" style={FONT}>
      <div className="mx-auto max-w-[1280px] px-10 text-center">
        <h2 className="text-xl font-bold text-[#001f49] mb-8">
          {language === "th" ? "พันธมิตรทางยุทธศาสตร์ของเรา" : "Our Strategic Partners"}
        </h2>
        <div className="flex items-center justify-center gap-10 flex-wrap">
          {partnerList.map((partner) => (
            <a
              key={partner.id}
              href={partner.websiteUrl || "#"}
              title={partner.name}
              className="flex flex-col items-center gap-2 text-[#44474f] hover:opacity-80 transition-opacity"
            >
              {partner.logoPath ? (
                <Image
                  src={partner.logoPath}
                  alt={partner.name}
                  width={64}
                  height={64}
                  className="object-contain"
                />
              ) : (
                <div className="w-16 h-16 bg-[#eeeeee] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#44474f]" style={{ fontSize: 32 }}>
                    business
                  </span>
                </div>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function HomePage({ record }: { record: ContentView }) {
  const { language } = record;
  const contactHref = language === "th" ? "/ติดต่อเรา" : "/en/ติดต่อเรา";

  return (
    <>
      <Suspense fallback={<HeroSkeleton />}>
        <HeroSection language={language} />
      </Suspense>

      <Suspense fallback={<NewsHomeSkeleton />}>
        <NewsSection language={language} />
      </Suspense>

      <Suspense fallback={<PartnersSkeleton />}>
        <PartnersSection language={language} />
      </Suspense>

      {/* Floating chat button */}
      <Link
        href={contactHref}
        className="fixed bottom-6 right-6 w-12 h-12 bg-[#0055c7] text-white flex items-center justify-center shadow-lg hover:bg-[#001f49] transition-colors z-50 rounded-full"
        aria-label={language === "th" ? "ติดต่อเรา" : "Contact us"}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 24 }}>chat</span>
      </Link>
    </>
  );
}
