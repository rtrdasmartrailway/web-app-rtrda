import Link from "next/link";
import Image from "next/image";
import type { WpContentRecord, WpImportManifest } from "@/lib/wp/types";
import { resolveCardImagePath } from "@/lib/wp/presentation";
import { formatDate } from "./site-helpers";

export function ArticleCard({
  manifest,
  record,
}: {
  manifest: WpImportManifest;
  record: WpContentRecord;
}) {
  const imagePath = resolveCardImagePath(record, manifest.media);
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
