"use client";

import { useEffect, useRef, useState } from "react";
import type { PdfReaderTarget } from "@/lib/wp/pdf-reader";

export function InlineRiskReportPdf({
  target,
  title,
}: {
  target: PdfReaderTarget;
  title: string;
}) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const pages = pagesRef.current;
    if (!isMobile || !pages) return;

    let cancelled = false;
    let observer: IntersectionObserver | undefined;
    let loadingTask: ReturnType<(typeof import("pdfjs-dist"))["getDocument"]> | undefined;
    pages.replaceChildren();
    setStatus("loading");

    const renderDocument = async () => {
      try {
        const [{ GlobalWorkerOptions, getDocument }, response] = await Promise.all([
          import("pdfjs-dist"),
          fetch(target.inlineHref),
        ]);
        if (!response.ok) throw new Error("PDF request failed");
        if (cancelled) return;

        GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        loadingTask = getDocument({ data: await response.arrayBuffer() });
        const document = await loadingTask.promise;
        if (cancelled) return;

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
          const width = Math.max(1, pages.clientWidth - 24);
          const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
          const viewport = page.getViewport({
            scale: (width / baseViewport.width) * pixelRatio,
          });
          const canvas = window.document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas unavailable");

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.style.width = `${Math.floor(viewport.width / pixelRatio)}px`;
          canvas.style.height = `${Math.floor(viewport.height / pixelRatio)}px`;
          canvas.setAttribute("aria-label", `หน้า ${pageNumber}`);
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          if (cancelled) return;

          pageElement.replaceChildren(canvas);
          if (pageNumber === 1) setStatus("ready");
        };

        const queuePageRender = (pageNumber: number, pageElement: HTMLDivElement) => {
          void renderPage(pageNumber, pageElement).catch(() => {
            if (!cancelled) setStatus("error");
          });
        };

        const pageElements = Array.from({ length: document.numPages }, (_, index) => {
          const pageElement = window.document.createElement("div");
          pageElement.className = "inline-risk-report-page";
          pageElement.dataset.page = String(index + 1);
          pageElement.style.aspectRatio = `${firstViewport.width} / ${firstViewport.height}`;
          pages.append(pageElement);
          return pageElement;
        });

        queuePageRender(1, pageElements[0]);

        if ("IntersectionObserver" in window) {
          observer = new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const pageElement = entry.target as HTMLDivElement;
                observer?.unobserve(pageElement);
                queuePageRender(Number(pageElement.dataset.page), pageElement);
              }
            },
            { rootMargin: "600px" },
          );
          for (const pageElement of pageElements.slice(1)) observer.observe(pageElement);
        } else {
          for (const [index, pageElement] of pageElements.slice(1).entries()) {
            queuePageRender(index + 2, pageElement);
          }
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    void renderDocument();
    return () => {
      cancelled = true;
      observer?.disconnect();
      void loadingTask?.destroy();
    };
  }, [isMobile, target.inlineHref]);

  return (
    <section className="inline-risk-report" aria-label={title}>
      <div className="inline-risk-report-toolbar">
        <span>{title}</span>
        <a href={target.downloadHref} target="_blank" rel="noreferrer">
          เปิด PDF ในแท็บใหม่
        </a>
      </div>
      {status === "loading" ? (
        <p className="inline-risk-report-status" role="status">
          กำลังโหลดเอกสาร PDF…
        </p>
      ) : null}
      {status === "error" ? (
        <p className="inline-risk-report-error" role="alert">
          ไม่สามารถแสดง PDF ได้ กรุณาเปิด PDF ในแท็บใหม่
        </p>
      ) : null}
      <div className="inline-risk-report-pages" ref={pagesRef} aria-label={title} />
    </section>
  );
}
