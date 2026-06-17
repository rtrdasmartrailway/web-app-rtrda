"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WpLanguage } from "@/lib/wp/types";
import type { PdfReaderTarget } from "@/lib/wp/pdf-reader";
import styles from "./pdf-reader.module.css";

type ActiveReader = PdfReaderTarget | null;

const RTRDA_READER_HOSTS = new Set([
  "test.rtrda.or.th",
  "www.rtrda.or.th",
  "rtrda.or.th",
  "localhost",
  "127.0.0.1",
]);

function normalizeReaderKey(value: string): string | null {
  try {
    const currentOrigin =
      typeof window === "undefined" ? "https://test.rtrda.or.th" : window.location.origin;
    const url = new URL(value, currentOrigin);
    if (
      !RTRDA_READER_HOSTS.has(url.hostname.toLowerCase()) &&
      url.origin !== currentOrigin
    ) {
      return null;
    }

    const decodedPath = decodeURIComponent(url.pathname).normalize("NFC");
    const downloadMatch = decodedPath.match(/^\/(?:en\/)?sdc_download\/([^/]+)\/?$/);
    if (downloadMatch) {
      return `/sdc_download/${downloadMatch[1]}`;
    }

    return decodedPath.replace(/\/$/, "") || "/";
  } catch {
    return null;
  }
}

export function PdfReader({
  targets,
  language,
}: {
  targets: PdfReaderTarget[];
  language: WpLanguage;
}) {
  const [active, setActive] = useState<ActiveReader>(null);
  const [loaded, setLoaded] = useState(false);
  const openerRef = useRef<HTMLAnchorElement | null>(null);

  const closeReader = useCallback(() => {
    setActive(null);
    setLoaded(false);
    window.requestAnimationFrame(() => openerRef.current?.focus());
  }, []);

  const targetByHref = useMemo(() => {
    const map = new Map<string, PdfReaderTarget>();
    for (const target of targets) {
      const key = normalizeReaderKey(target.sourceHref);
      if (key) {
        map.set(key, target);
      }
    }
    return map;
  }, [targets]);

  useEffect(() => {
    if (targetByHref.size === 0) {
      return;
    }

    const root = document.querySelector(".wp-content");
    if (!root) {
      return;
    }

    const onClick = (event: Event) => {
      if (!(event instanceof MouseEvent)) {
        return;
      }
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || !root.contains(anchor)) {
        return;
      }
      if (anchor.dataset.pdfReaderIgnore === "true") {
        return;
      }

      const key = normalizeReaderKey(anchor.getAttribute("href") ?? "");
      const readerTarget = key ? targetByHref.get(key) : undefined;
      if (!readerTarget) {
        return;
      }

      event.preventDefault();
      openerRef.current = anchor;
      setLoaded(false);
      setActive(readerTarget);
    };

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [targetByHref]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeReader();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    document.body.classList.add("pdf-reader-open");
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("pdf-reader-open");
    };
  }, [active, closeReader]);

  if (!active) {
    return null;
  }

  const label = language === "th" ? "เอกสาร PDF" : "PDF document";
  const closeLabel = language === "th" ? "ปิด" : "Close";
  const downloadLabel = language === "th" ? "ดาวน์โหลด" : "Download";
  const openLabel = language === "th" ? "เปิดแท็บใหม่" : "Open new tab";
  const loadingLabel = language === "th" ? "กำลังโหลดเอกสาร..." : "Loading document...";

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={closeReader}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-reader-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <span>{label}</span>
            <h2 id="pdf-reader-title">{active.title}</h2>
          </div>
          <button type="button" className={styles.closeButton} onClick={closeReader}>
            {closeLabel}
          </button>
        </header>

        <div className={styles.toolbar}>
          <a href={active.downloadHref} download>
            {downloadLabel}
          </a>
          <a href={active.inlineHref} target="_blank" rel="noreferrer">
            {openLabel}
          </a>
        </div>

        <div className={styles.frameShell}>
          {!loaded ? <div className={styles.loading}>{loadingLabel}</div> : null}
          <iframe
            src={active.inlineHref}
            title={active.title}
            className={styles.frame}
            onLoad={() => setLoaded(true)}
          />
        </div>
      </section>
    </div>
  );
}
