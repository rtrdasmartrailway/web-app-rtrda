"use client";

import { useEffect } from "react";

export const LEGACY_ORIGIN = "https://www.rtrda.or.th";
export const LOCAL_PREFIXES = ["/wp-content/uploads/", "/wp-content/"];

export function isLocalContentPath(value: string): boolean {
  return LOCAL_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export function toLegacyUrl(path: string): string {
  return `${LEGACY_ORIGIN}${path}`;
}

export function addCacheBuster(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=2`;
}

/**
 * Extract the local path from an img src that may be a relative path,
 * an absolute legacy URL, or an already-rewritten legacy URL.
 */
export function getLocalPath(url: string): string | null {
  if (url.startsWith("/")) return url.split("?")[0];
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "www.rtrda.or.th" || parsed.hostname === "rtrda.or.th") {
      return parsed.pathname;
    }
  } catch {
    // ignore malformed URLs
  }
  return null;
}

/**
 * Fallback handler for images inside .wp-content.
 *
 * Images keep their original local /wp-content/uploads/ paths so the
 * migrated site serves them directly. Only if a local image actually fails
 * to load do we retry against the legacy WordPress host. Anchor hrefs are
 * left untouched so in-site PDF/download handling keeps working.
 *
 * Images that still cannot be loaded (or have zero natural width) get the
 * .error class so a CSS placeholder takes over instead of an empty box.
 *
 * MutationObserver re-scans the DOM for client-navigation re-renders.
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

      const originalSrc = img.getAttribute("src") || "";

      const retryWithLegacy = () => {
        const currentSrc = img.getAttribute("src") || "";
        const localPath = getLocalPath(currentSrc);
        if (!localPath || !isLocalContentPath(localPath)) {
          markError(img);
          return;
        }
        const legacyUrl = addCacheBuster(toLegacyUrl(localPath));
        img.setAttribute("src", legacyUrl);
        // Keep watching for the legacy attempt's result.
        watchedImgs.delete(img);
        watchImage(img);
      };

      if (img.complete && img.naturalWidth === 0 && img.src) {
        retryWithLegacy();
        return;
      }

      img.addEventListener("error", retryWithLegacy, { once: true });
      img.addEventListener(
        "load",
        () => {
          if (img.naturalWidth === 0) {
            retryWithLegacy();
          }
        },
        { once: true },
      );

      // Preserve the original local src in case another script or React
      // re-render tries to mutate it back to a broken value.
      if (originalSrc && !img.hasAttribute("data-local-src")) {
        img.setAttribute("data-local-src", originalSrc);
      }
    };

    const scan = () => {
      root.querySelectorAll<HTMLImageElement>("img").forEach(watchImage);
    };

    scan();

    const observer = new MutationObserver(() => scan());
    observer.observe(root, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
