"use client";

import { useEffect } from "react";

export const LOCAL_ASSET_PREFIXES = ["/wp-content/", "/sdc-downloads/"];
export const LEGACY_HOSTS = new Set(["www.rtrda.or.th", "rtrda.or.th"]);

export function isLocalAssetPath(value: string): boolean {
  return LOCAL_ASSET_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export function toLocalAssetPath(value: string): string {
  if (isLocalAssetPath(value)) return value;

  try {
    const parsed = new URL(value);
    if (LEGACY_HOSTS.has(parsed.hostname) && isLocalAssetPath(parsed.pathname)) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // Relative non-URL values are returned unchanged below.
  }

  return value;
}

export function rewriteSrcsetToLocal(value: string): string {
  return value
    .split(",")
    .map((candidate) => {
      const trimmed = candidate.trim();
      if (!trimmed) return candidate;
      const [url, ...descriptor] = trimmed.split(/\s+/);
      const rewritten = toLocalAssetPath(url);
      return [rewritten, ...descriptor].join(" ");
    })
    .join(", ");
}

/**
 * Local-only WordPress asset normalizer.
 *
 * This site is becoming the source of truth, so browser-visible assets must
 * resolve from the migrated app's local `/wp-content/...` and `/sdc-downloads/...`
 * mirrors. We do not fallback to the legacy WordPress host. Legacy absolute
 * asset URLs that survive imported HTML are rewritten back to local paths;
 * missing local files are marked with `.error` so the CSS placeholder shows the
 * problem instead of silently hotlinking from the old production site.
 */
export function WpImageFallback() {
  useEffect(() => {
    const root = document.querySelector(".wp-content");
    if (!root) return;

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
      root.querySelectorAll<HTMLElement>("[src], [srcset], [href]").forEach((node) => {
        const src = node.getAttribute("src");
        if (src) node.setAttribute("src", toLocalAssetPath(src));

        const srcset = node.getAttribute("srcset");
        if (srcset) node.setAttribute("srcset", rewriteSrcsetToLocal(srcset));

        const href = node.getAttribute("href");
        if (href) node.setAttribute("href", toLocalAssetPath(href));
      });

      root.querySelectorAll<HTMLImageElement>("img").forEach(watchImage);
    };

    scan();

    const observer = new MutationObserver(() => scan());
    observer.observe(root, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
