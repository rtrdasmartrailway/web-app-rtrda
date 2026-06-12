import Link from "next/link";
import Image from "next/image";
import type { WpContentRecord } from "@/lib/wp/types";
import { getLatestPosts } from "@/db/queries";
import { SiteShell, formatDate } from "@/components/rtrda-shared";
import { HeroSlider } from "./HeroSlider";

// ─── Mock data (replaced by DB tables later) ─────────────────────────────────

const MOCK_EVENTS = [
  { date: 7, label: "งาน Asia Pacific Rail 2026", color: "#0055c7" },
  { date: 14, label: 'สัมมนา "ยาง+ราง"', color: "#8b0000" },
];

const MOCK_PARTNERS = [
  { name: "กระทรวงคมนาคม", icon: "directions_railway" },
  { name: "กรมทางหลวง", icon: "route" },
  { name: "กรมการขนส่งทางราง", icon: "train" },
  { name: "การรถไฟแห่งประเทศไทย", icon: "tram" },
  { name: "สนข.", icon: "account_balance" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCategoryBadge(record: WpContentRecord): string {
  const path = record.parentPath ?? record.path;
  if (path.includes("งานวิจัย")) return "งานวิจัย";
  if (path.includes("โครงการ")) return "โครงการ";
  if (path.includes("ความร่วมมือ")) return "ความร่วมมือ";
  if (path.includes("อบรม") || path.includes("สัมมนา")) return "อบรม/สัมมนา";
  return "ข่าวสาร";
}

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function buildCalendarCells(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const thaiFirstDay = firstDay === 0 ? 6 : firstDay - 1; // Thai week starts Mon
  const cells: (number | null)[] = [];
  for (let i = 0; i < thaiFirstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CalendarWidget() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const cells = buildCalendarCells(year, month);
  const eventMap = new Map(MOCK_EVENTS.map((e) => [e.date, e]));

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
              style={event && !isToday ? { backgroundColor: event.color } : undefined}
              title={event?.label}
            >
              {day}
            </div>
          );
        })}
      </div>

      <div className="mt-4 space-y-1.5">
        {MOCK_EVENTS.map((event, i) => (
          <div key={i} className="flex items-center gap-2 text-[12px] text-[#44474f]">
            <span
              className="w-3 h-3 flex-shrink-0 rounded-sm inline-block"
              style={{ backgroundColor: event.color }}
            />
            {event.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export async function HomePage({ record }: { record: WpContentRecord }) {
  const { language } = record;
  const posts = await getLatestPosts(language, 5);
  const newsPosts = posts.slice(0, 3);
  const articlePosts = posts.slice(3, 5);

  const newsHref = language === "th" ? "/ข่าวสาร-กิจกรรม" : "/en/ข่าวสาร-กิจกรรม";
  const contactHref = language === "th" ? "/ติดต่อเรา" : "/en/ติดต่อเรา";

  return (
    <SiteShell path={record.path}>
      {/* Hero Slider */}
      <HeroSlider />

      {/* ข่าวสารและกิจกรรม */}
      <section className="py-16 bg-white" style={{ fontFamily: "'Hanken Grotesk', 'Noto Sans Thai', sans-serif" }}>
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
            {newsPosts.map((post) => {
              const badge = getCategoryBadge(post);
              const dateText = formatDate(post.date, language);
              const imageSrc = post.featuredMediaPath ?? "/stitch-assets/page-hero.png";

              return (
                <article key={post.id} className="bg-white border border-[#c3c6d2] overflow-hidden group">
                  <div className="relative h-52 overflow-hidden">
                    <Image
                      src={imageSrc}
                      alt=""
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                    <span className="absolute top-3 left-3 bg-[#0055c7] text-white text-[11px] font-bold px-2 py-1 uppercase tracking-wide">
                      {badge}
                    </span>
                  </div>
                  <div className="p-4">
                    {dateText && (
                      <div className="flex items-center gap-1.5 text-xs text-[#44474f] mb-2">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>calendar_today</span>
                        <time dateTime={post.date}>{dateText}</time>
                      </div>
                    )}
                    <h3 className="text-[15px] font-bold text-[#001f49] mb-2 line-clamp-2 leading-snug">
                      {post.title}
                    </h3>
                    {post.excerpt && (
                      <p className="text-sm text-[#44474f] line-clamp-3 mb-3 leading-relaxed">
                        {post.excerpt}
                      </p>
                    )}
                    <Link
                      href={post.path}
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
      <section className="py-16 bg-[#f3f3f3]" style={{ fontFamily: "'Hanken Grotesk', 'Noto Sans Thai', sans-serif" }}>
        <div className="mx-auto max-w-[1280px] px-10">
          <div className="flex gap-8 items-start flex-col lg:flex-row">
            {/* บทความล่าสุด */}
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-[#001f49] mb-2">
                {language === "th" ? "บทความล่าสุด" : "Latest Articles"}
              </h2>
              <div className="w-16 h-1 bg-[#0055c7] mb-6" />

              <div className="space-y-4">
                {articlePosts.map((post) => {
                  const dateText = formatDate(post.date, language);
                  const imageSrc = post.featuredMediaPath ?? "/stitch-assets/page-hero.png";

                  return (
                    <article key={post.id} className="bg-white border border-[#c3c6d2] p-4 flex gap-4 group">
                      <div className="flex-shrink-0 w-32 h-24 relative overflow-hidden">
                        <Image
                          src={imageSrc}
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
                            {post.title}
                          </h3>
                          {post.excerpt && (
                            <p className="text-xs text-[#44474f] line-clamp-2 leading-relaxed">
                              {post.excerpt}
                            </p>
                          )}
                        </div>
                        <Link
                          href={post.path}
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
              <CalendarWidget />
            </div>
          </div>
        </div>
      </section>

      {/* พันธมิตรทางยุทธศาสตร์ */}
      <section
        className="py-16 bg-white border-t border-[#c3c6d2]"
        style={{ fontFamily: "'Hanken Grotesk', 'Noto Sans Thai', sans-serif" }}
      >
        <div className="mx-auto max-w-[1280px] px-10 text-center">
          <h2 className="text-xl font-bold text-[#001f49] mb-8">
            {language === "th" ? "พันธมิตรทางยุทธศาสตร์ของเรา" : "Our Strategic Partners"}
          </h2>
          <div className="flex items-center justify-center gap-10 flex-wrap">
            {MOCK_PARTNERS.map((partner) => (
              <div
                key={partner.name}
                className="flex flex-col items-center gap-2 text-[#44474f]"
                title={partner.name}
              >
                <div className="w-16 h-16 bg-[#eeeeee] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#44474f]" style={{ fontSize: 32 }}>
                    {partner.icon}
                  </span>
                </div>
              </div>
            ))}
            <div className="text-xs font-bold text-[#44474f] uppercase tracking-widest">MINISTRY</div>
          </div>
        </div>
      </section>

      {/* Floating chat button */}
      <Link
        href={contactHref}
        className="fixed bottom-6 right-6 w-12 h-12 bg-[#0055c7] text-white flex items-center justify-center shadow-lg hover:bg-[#001f49] transition-colors z-50 rounded-full"
        aria-label={language === "th" ? "ติดต่อเรา" : "Contact us"}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 24 }}>chat</span>
      </Link>
    </SiteShell>
  );
}
