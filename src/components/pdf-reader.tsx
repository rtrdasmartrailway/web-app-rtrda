"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { WpLanguage } from "@/lib/wp/types";
import type { PdfReaderTarget } from "@/lib/wp/pdf-reader";
import styles from "./pdf-reader.module.css";

type ActiveReader = PdfReaderTarget | null;

interface ProtectedPreviewDetail {
  documentId?: string;
  previewUrl?: string;
}

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
  const [renderError, setRenderError] = useState("");
  const openerRef = useRef<HTMLAnchorElement | null>(null);
  const pagesRef = useRef<HTMLDivElement | null>(null);

  const closeReader = useCallback(() => {
    setActive(null);
    setLoaded(false);
    setRenderError("");
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
      setRenderError("");
      setActive(readerTarget);
    };

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [targetByHref]);

  const openProtectedPreview = useEffectEvent((event: Event) => {
    const detail = (event as CustomEvent<ProtectedPreviewDetail>).detail;
    if (!detail?.documentId || !detail.previewUrl) return;
    const target = targets.find(
      (value) => value.protectedPreviewId === detail.documentId,
    );
    if (!target) return;
    setLoaded(false);
    setRenderError("");
    setActive({ ...target, inlineHref: detail.previewUrl });
  });

  useEffect(() => {
    window.addEventListener("rtrda-protected-preview", openProtectedPreview);
    return () =>
      window.removeEventListener("rtrda-protected-preview", openProtectedPreview);
  }, []);

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

  useEffect(() => {
    if (!active || !pagesRef.current) return;

    let cancelled = false;
    let observer: IntersectionObserver | undefined;
    let loadingTask: ReturnType<(typeof import("pdfjs-dist"))["getDocument"]> | undefined;
    const pages = pagesRef.current;
    pages.replaceChildren();
    setLoaded(false);
    setRenderError("");

    const renderDocument = async () => {
      try {
        const [{ GlobalWorkerOptions, getDocument }, response] = await Promise.all([
          import("pdfjs-dist"),
          fetch(active.inlineHref),
        ]);
        if (!response.ok) throw new Error("PDF request failed");
        if (cancelled) return;

        GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        loadingTask = getDocument({ data: await response.arrayBuffer() });
        const document = await loadingTask.promise;
        const availableWidth = Math.max(1, pages.clientWidth - 32);
        const pixelRatio = window.devicePixelRatio || 1;
        const firstPage = await document.getPage(1);
        const firstViewport = firstPage.getViewport({ scale: 1 });
        const rendering = new Set<number>();

        const renderPage = async (pageNumber: number, pageElement: HTMLDivElement) => {
          if (cancelled || rendering.has(pageNumber)) return;
          rendering.add(pageNumber);
          const page = pageNumber === 1 ? firstPage : await document.getPage(pageNumber);
          if (cancelled) return;
          const baseViewport =
            pageNumber === 1 ? firstViewport : page.getViewport({ scale: 1 });
          const scale = (availableWidth / baseViewport.width) * pixelRatio;
          const viewport = page.getViewport({ scale });
          const canvas = window.document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas unavailable");

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.style.width = `${Math.floor(viewport.width / pixelRatio)}px`;
          canvas.style.height = `${Math.floor(viewport.height / pixelRatio)}px`;
          canvas.setAttribute("aria-label", `Page ${pageNumber}`);
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          if (cancelled) return;
          pageElement.replaceChildren(canvas);
          if (pageNumber === 1) setLoaded(true);
        };

        const pageElements = Array.from({ length: document.numPages }, (_, index) => {
          const pageElement = window.document.createElement("div");
          pageElement.className = styles.page;
          pageElement.dataset.page = String(index + 1);
          pageElement.style.aspectRatio = `${firstViewport.width} / ${firstViewport.height}`;
          pages.append(pageElement);
          return pageElement;
        });

        // The first page must not depend on an observer callback to make the reader usable.
        void renderPage(1, pageElements[0]);

        if ("IntersectionObserver" in window) {
          observer = new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const pageElement = entry.target as HTMLDivElement;
                observer?.unobserve(pageElement);
                void renderPage(Number(pageElement.dataset.page), pageElement);
              }
            },
            { root: pages, rootMargin: "600px" },
          );
          for (const pageElement of pageElements.slice(1)) observer.observe(pageElement);
        } else {
          for (const [index, pageElement] of pageElements.slice(1, 3).entries()) {
            void renderPage(index + 2, pageElement);
          }
        }
      } catch {
        if (!cancelled) {
          setRenderError(
            language === "th" ? "ไม่สามารถแสดงเอกสารได้" : "Unable to display document",
          );
        }
      }
    };

    void renderDocument();
    return () => {
      cancelled = true;
      observer?.disconnect();
      void loadingTask?.destroy();
    };
  }, [active, language]);

  if (!active) {
    return null;
  }

  const label = language === "th" ? "เอกสาร PDF" : "PDF document";
  const closeLabel = language === "th" ? "ปิด" : "Close";
  const downloadLabel = language === "th" ? "ดาวน์โหลด" : "Download";
  const loadingLabel = language === "th" ? "กำลังโหลดเอกสาร..." : "Loading document...";
  const requestProtectedDownload = () => {
    window.dispatchEvent(
      new CustomEvent("rtrda-protected-download", {
        detail: { documentId: active.protectedDownloadId },
      }),
    );
  };

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
          {active.protectedDownloadId ? (
            <button type="button" onClick={requestProtectedDownload}>
              {downloadLabel}
            </button>
          ) : (
            <a href={active.downloadHref} download>
              {downloadLabel}
            </a>
          )}
        </div>

        <div className={styles.frameShell}>
          {!loaded ? <div className={styles.loading}>{loadingLabel}</div> : null}
          {renderError ? <p className={styles.error}>{renderError}</p> : null}
          <div className={styles.pages} ref={pagesRef} aria-label={active.title} />
        </div>
      </section>
    </div>
  );
}
