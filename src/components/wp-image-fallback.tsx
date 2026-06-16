"use client";

import { useEffect } from "react";

const LEGACY_ORIGIN = "https://www.rtrda.or.th";

/**
 * Two responsibilities:
 *
 * 1. URL rewrite — every <img> inside .wp-content whose src is a
 *    relative /wp-content/uploads/ path or a relative /sdc_download/
 *    href (for any <a>) is rewritten at runtime to the absolute
 *    legacy WP host. The frozen src/data/wp-content.json still
 *    contains the relative URLs and the public Docker image is
 *    missing the mirrored public/wp-content/uploads and
 *    public/sdc-downloads directories (see .dockerignore), so without
 *    this rewrite every cover image, every 3d-flip-book link, and
 *    every sdc_download link 404s on the deployed site.
 *
 * 2. Error placeholder — if a rewritten image still fails to load
 *    (e.g. legacy returned 500 and the browser tried the original
 *    srcset), the .error class is added so the CSS placeholder takes
 *    over instead of leaving an empty box.
 *
 * srcset attributes are also rewritten. Modern browsers prefer srcset
 * for responsive images, so leaving relative paths in srcset breaks
 * even when the primary src is absolute.
 *
 * MutationObserver re-scans the DOM for client-navigation re-renders.
 */
export function WpImageFallback() {
  useEffect(() => {
    const root = document.querySelector(".wp-content");
    if (!root) return;

    // Pairs of attribute name + URL prefix matcher. We rewrite the
    // value if it starts with one of the relative prefixes; if it
    // already starts with http, leave it alone.
    const targets: Array<{
      attr: "src" | "srcset" | "href";
      match: (value: string) => boolean;
      rewrite: (value: string) => string;
    }> = [
      {
        attr: "src",
        match: (v) => v.startsWith("/wp-content/uploads/"),
        // Add ?v=2 to bust any stale CF/browsing 404 cache.
        // /เกี่ยวกับ-สทร/วิสัยทัศน์-พันธกิจ has rows 5+6 whose
        // images (manpower.png, database.png) cached as 404
        // locally even though the live URL now returns 200.
        rewrite: (v) => `${LEGACY_ORIGIN}${v}?v=2`,
      },
      {
        attr: "href",
        match: (v) =>
          v.startsWith("/wp-content/uploads/") ||
          v.startsWith("/3d-flip-book/") ||
          v.startsWith("/sdc_download/"),
        rewrite: (v) => LEGACY_ORIGIN + v,
      },
      {
        attr: "srcset",
        // srcset is "url sizew, url sizew, ..."; we rewrite every url
        // token that begins with a relative prefix.
        match: (v) =>
          /(\s|^)(\/wp-content\/uploads\/|\/wp-content\/)/.test(v) &&
          !v.includes(LEGACY_ORIGIN),
        rewrite: (v) =>
          v
            .replace(
              /(\s|^)(\/wp-content\/uploads\/[^\s,]+)/g,
              (_, sp, url) => `${sp}${LEGACY_ORIGIN}${url}?v=2`,
            )
            .replace(
              /(\s|^)(\/wp-content\/[^\s,]+)/g,
              (_, sp, url) => `${sp}${LEGACY_ORIGIN}${url}`,
            ),
      },
    ];

    const watchedImgs = new WeakSet<HTMLImageElement>();

    const markError = (img: HTMLImageElement) => {
      if (!img.classList.contains("error")) {
        img.classList.add("error");
      }
    };

    const watchImage = (img: HTMLImageElement) => {
      if (watchedImgs.has(img)) return;
      watchedImgs.add(img);
      if (img.complete && img.naturalWidth === 0 && img.src) {
        markError(img);
        return;
      }
      img.addEventListener("error", () => markError(img), { once: true });
      img.addEventListener(
        "load",
        () => {
          if (img.naturalWidth === 0) markError(img);
        },
        { once: true },
      );
    };

    const scan = () => {
      for (const target of targets) {
        const nodes = root.querySelectorAll<HTMLElement>(
          `[${target.attr}]:not([data-legacy-rewritten-${target.attr}])`,
        );
        nodes.forEach((node) => {
          const value = node.getAttribute(target.attr);
          if (!value) return;
          if (!target.match(value)) {
            // Mark as processed so we don't re-evaluate it on every scan.
            node.setAttribute(`data-legacy-rewritten-${target.attr}`, "skipped");
            return;
          }
          const next = target.rewrite(value);
          node.setAttribute(target.attr, next);
          node.setAttribute(`data-legacy-rewritten-${target.attr}`, "1");
        });
      }
      root.querySelectorAll<HTMLImageElement>("img").forEach(watchImage);
    };

    scan();

    const observer = new MutationObserver(() => scan());
    observer.observe(root, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
