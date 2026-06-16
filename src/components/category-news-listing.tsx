import Link from "next/link";
import Image from "next/image";
import type { Card } from "@/lib/db/page-data";
import { formatDate } from "./site-helpers";

/**
 * Category listing — renders each news item as a 3-column card grid.
 * Replaces the legacy <ul class="wp-import-list"> flat list.
 */
export function CategoryNewsListing({ cards }: { cards: Card[] }) {
  if (cards.length === 0) return null;

  return (
    <div className="news-listing">
      {cards.map((card) => {
        const { record, imagePath } = card;
        const dateText = formatDate(record.date, record.language);
        return (
          <Link key={record.id} href={record.path} className="news-card">
            <span className="news-card-image">
              <Image
                src={imagePath}
                alt=""
                fill
                sizes="(max-width: 680px) 100vw, (max-width: 980px) 50vw, 33vw"
              />
            </span>
            <span className="news-card-content">
              {dateText ? <time dateTime={record.date}>{dateText}</time> : null}
              <strong>{record.title}</strong>
              {record.excerpt ? (
                <span className="news-card-excerpt">{record.excerpt}</span>
              ) : null}
              <span className="read-link">
                {record.language === "th" ? "อ่านเพิ่มเติม" : "Continue Reading"}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
