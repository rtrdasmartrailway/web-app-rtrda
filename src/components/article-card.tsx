import Link from "next/link";
import Image from "next/image";
import type { Card } from "@/lib/db/page-data";
import { formatDate } from "./site-helpers";

const KIND_BADGE: Record<string, { th: string; en: string } | undefined> = {
  flipbook: { th: "เอกสาร PDF", en: "PDF" },
  post: { th: "ข่าวสาร", en: "News" },
};

export function ArticleCard({ card }: { card: Card }) {
  const { record, imagePath } = card;
  const dateText = formatDate(record.date, record.language);
  const badge = KIND_BADGE[record.kind];

  return (
    <Link href={record.path} className="article-card">
      <span className="article-image">
        <Image
          src={imagePath}
          alt=""
          fill
          sizes="(max-width: 680px) 100vw, (max-width: 980px) 50vw, 33vw"
        />
        {badge ? <span className="article-badge">{badge[record.language]}</span> : null}
      </span>
      <span className="article-content">
        {dateText ? <time dateTime={record.date}>{dateText}</time> : null}
        <strong>{record.title}</strong>
        {record.excerpt ? (
          <span className="article-excerpt">{record.excerpt}</span>
        ) : null}
        <span className="read-link">
          {record.language === "th" ? "อ่านเพิ่มเติม" : "Continue Reading"}
        </span>
      </span>
    </Link>
  );
}
