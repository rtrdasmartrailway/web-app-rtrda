import Link from "next/link";
import Image from "next/image";
import type { WpLanguage } from "@/lib/wp/types";
import type { ContentView } from "@/lib/content/types";
import {
  getContentByPath,
  getGeneratedAt,
  getNavItems,
  getTopLevelPages,
} from "@/db/queries";
import { SiteFooter } from "./SiteFooter";
import {
  buildPrimaryNavigation,
  selectFallbackAsset,
  type PresentationSidebarItem,
} from "@/lib/wp/presentation";
import { RtrdaNavigation } from "./rtrda-navigation";

export function formatDate(value: string, language: WpLanguage): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-US", {
    dateStyle: "medium",
  }).format(date);
}

export function currentLanguage(path: string): WpLanguage {
  return path === "/en" || path.startsWith("/en/") ? "en" : "th";
}

export async function resolveCounterpartPath(
  currentPath: string,
  language: WpLanguage,
): Promise<string> {
  if (language === "th") {
    const englishPath = currentPath === "/" ? "/en" : `/en${currentPath}`;
    const found = await getContentByPath(englishPath);
    return found ? englishPath : "/en";
  }
  const thaiPath = currentPath === "/en" ? "/" : currentPath.replace(/^\/en/, "") || "/";
  const found = await getContentByPath(thaiPath);
  return found ? thaiPath : "/";
}

export function resolveCardImagePath(record: ContentView): string {
  return record.featuredImagePath ?? selectFallbackAsset(record);
}

export function ArticleCard({ record }: { record: ContentView }) {
  const imagePath = resolveCardImagePath(record);
  const dateText = formatDate(record.date, record.language);

  return (
    <Link href={record.path} className="article-card">
      <span className="article-image">
        <Image
          src={imagePath}
          alt=""
          fill
          sizes="(max-width: 680px) 100vw, (max-width: 980px) 50vw, 33vw"
        />
      </span>
      <span className="article-content">
        {dateText ? <time dateTime={record.date}>{dateText}</time> : null}
        <strong>{record.title}</strong>
        {record.excerpt ? <span className="article-excerpt">{record.excerpt}</span> : null}
        <span className="read-link">
          {record.language === "th" ? "อ่านเพิ่มเติม" : "Continue Reading"}
        </span>
      </span>
    </Link>
  );
}

export function SideNavigation({
  items,
  title,
}: {
  items: PresentationSidebarItem[];
  title: string;
}) {
  if (items.length === 0) return null;

  return (
    <aside className="page-sidebar" aria-label={title}>
      <h2>{title}</h2>
      <nav>
        {items.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            className={item.active ? "active" : undefined}
          >
            <span>{item.label}</span>
            <span aria-hidden="true" className="sidebar-arrow" />
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export async function SiteShell({
  children,
  path,
}: {
  children: React.ReactNode;
  path: string;
}) {
  const language = currentLanguage(path);

  const [alternate, wpNavItems, topLevelPages, generatedAt] = await Promise.all([
    resolveCounterpartPath(path, language),
    getNavItems(language),
    getTopLevelPages(language),
    getGeneratedAt(),
  ]);

  const navItems = buildPrimaryNavigation(
    topLevelPages,
    language,
    path,
    wpNavItems.length ? wpNavItems : undefined,
  );

  return (
    <div className="site-shell">
      <RtrdaNavigation alternatePath={alternate} language={language} navItems={navItems} />
      <main>{children}</main>
      <SiteFooter language={language} generatedAt={generatedAt} />
    </div>
  );
}
