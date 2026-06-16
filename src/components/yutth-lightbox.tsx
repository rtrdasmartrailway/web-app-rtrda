"use client";

import { useEffect, useState } from "react";

type LightboxState = {
  src: string;
  alt: string;
  caption?: string;
} | null;

/**
 * Wires all <img data-lightbox> in .wp-content to a click-to-zoom modal.
 * The page can ship plain HTML with data-lightbox; this component is the
 * single source of behavior so we don't need to embed inline JS in DB HTML.
 */
export function YutthLightbox() {
  const [active, setActive] = useState<LightboxState>(null);

  useEffect(() => {
    const root = document.querySelector(".wp-content");
    if (!root) return;
    const imgs = Array.from(
      root.querySelectorAll<HTMLImageElement>("img[data-lightbox]"),
    );
    if (imgs.length === 0) return;

    const onClick = (e: Event) => {
      const img = e.currentTarget as HTMLImageElement;
      e.preventDefault();
      setActive({
        src: img.getAttribute("data-fullsrc") || img.getAttribute("src") || "",
        alt: img.alt || "",
        caption: img.getAttribute("data-caption") || img.getAttribute("alt") || undefined,
      });
    };
    imgs.forEach((img) => {
      img.style.cursor = "zoom-in";
      img.addEventListener("click", onClick);
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      imgs.forEach((img) => img.removeEventListener("click", onClick));
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!active) return null;

  return (
    <div
      className="yutth-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={active.alt}
      onClick={() => setActive(null)}
    >
      <button
        type="button"
        className="yutth-lightbox-close"
        aria-label="ปิด"
        onClick={(e) => {
          e.stopPropagation();
          setActive(null);
        }}
      >
        ×
      </button>
      <figure className="yutth-lightbox-figure" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={active.src} alt={active.alt} />
        {active.caption ? <figcaption>{active.caption}</figcaption> : null}
      </figure>
    </div>
  );
}
