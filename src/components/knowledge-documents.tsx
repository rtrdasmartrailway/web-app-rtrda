import Image from "next/image";
import type {
  KnowledgeDocument,
  KnowledgeDocumentGroup,
} from "@/lib/wp/knowledge-documents";
import type { WpLanguage } from "@/lib/wp/types";
import styles from "./knowledge-documents.module.css";

function isImagePreview(href: string | null): boolean {
  return Boolean(href?.match(/\.(?:png|jpe?g|webp|gif|avif)$/i));
}

function labels(language: WpLanguage) {
  return language === "th"
    ? {
        preview: "อ่านเพิ่มเติม",
        download: "ดาวน์โหลดไฟล์",
        noFile: "ยังไม่มีไฟล์",
        noDownload: "ไม่มีไฟล์ดาวน์โหลด",
        coverAlt: "ภาพปกเอกสาร",
      }
    : {
        preview: "Read more",
        download: "Download",
        noFile: "No file yet",
        noDownload: "No download",
        coverAlt: "Document cover",
      };
}

function DocumentAction({
  href,
  children,
  disabledLabel,
  download,
  protectedDocumentId,
}: {
  href: string | null;
  children: string;
  disabledLabel: string;
  download?: boolean;
  protectedDocumentId?: string;
}) {
  if (!href) {
    return (
      <span className={`${styles.action} ${styles.disabled}`} aria-disabled="true">
        {disabledLabel}
      </span>
    );
  }

  return (
    <a
      className={download ? `${styles.action} ${styles.download}` : styles.action}
      data-pdf-reader-ignore={download || protectedDocumentId ? "true" : undefined}
      data-protected-download={download ? protectedDocumentId : undefined}
      data-protected-preview={download ? undefined : protectedDocumentId}
      download={download && !protectedDocumentId ? true : undefined}
      href={href}
      rel={isImagePreview(href) ? "noreferrer" : undefined}
      target={isImagePreview(href) ? "_blank" : undefined}
    >
      {children}
    </a>
  );
}

function fileTypeLabel(document: KnowledgeDocument): string {
  const href = document.downloadHref ?? document.previewHref ?? "";
  if (/\.xlsx$/i.test(href)) {
    return "XLSX";
  }
  if (/\.pdf$/i.test(href)) {
    return "PDF";
  }
  return "FILE";
}

function KnowledgeDocumentCard({
  document,
  language,
}: {
  document: KnowledgeDocument;
  language: WpLanguage;
}) {
  const text = labels(language);

  return (
    <article className={styles.card}>
      <div className={styles.cover}>
        {document.coverImage ? (
          <Image
            src={document.coverImage}
            alt={document.coverAlt || `${text.coverAlt}: ${document.title}`}
            className={styles.coverImage}
            fill
            sizes="(max-width: 720px) 170px, 190px"
            unoptimized
          />
        ) : (
          <div className={styles.coverFallback} aria-label={fileTypeLabel(document)}>
            {fileTypeLabel(document)}
          </div>
        )}
      </div>

      <div className={styles.body}>
        <h3>{document.title}</h3>
        {document.description ? <p>{document.description}</p> : null}
      </div>

      <div className={styles.actions}>
        <DocumentAction
          href={document.previewHref}
          disabledLabel={text.noFile}
          protectedDocumentId={document.protectedDocumentId}
        >
          {text.preview}
        </DocumentAction>
        <DocumentAction
          href={document.downloadHref}
          disabledLabel={document.hasUsableTarget ? text.noDownload : text.noFile}
          download
          protectedDocumentId={document.protectedDocumentId}
        >
          {text.download}
        </DocumentAction>
      </div>
    </article>
  );
}

export function KnowledgeDocuments({
  groups,
  language,
}: {
  groups: KnowledgeDocumentGroup[];
  language: WpLanguage;
}) {
  return (
    <div className={`wp-content ${styles.root}`}>
      {groups.map((group) => (
        <section className={styles.group} key={group.title}>
          <details open={group.open}>
            <summary className={styles.summary}>
              <span>{group.title}</span>
            </summary>
            {group.documents.length > 0 ? (
              <div
                className={
                  group.compact ? `${styles.grid} ${styles.compactGrid}` : styles.grid
                }
              >
                {group.documents.map((document, index) => (
                  <KnowledgeDocumentCard
                    key={`${group.title}-${document.title}-${index}`}
                    document={document}
                    language={language}
                  />
                ))}
              </div>
            ) : null}
          </details>
        </section>
      ))}
    </div>
  );
}
