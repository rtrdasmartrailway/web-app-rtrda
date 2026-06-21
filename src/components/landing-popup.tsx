"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export const LANDING_POPUP_SESSION_KEY = "rtrda-landing-popup-85-dismissed";

type PopupStorage = Pick<Storage, "getItem" | "setItem">;

export const LANDING_POPUP_CONTENT = {
  src: "/wp-content/uploads/2026/06/อินโฟภายนอก-11-2-1024x1024.png",
  alt: "ประกาศประชาสัมพันธ์จากสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง",
  closeLabel: "ปิดหน้าต่าง",
  width: 1024,
  height: 1024,
} as const;

export function isPublicLandingPopupPath(path: string): boolean {
  return !path.startsWith("/rtrdaintranet");
}

export function shouldShowLandingPopup(
  storage: PopupStorage | null | undefined,
): boolean {
  if (!storage) return true;

  try {
    return storage.getItem(LANDING_POPUP_SESSION_KEY) !== "1";
  } catch {
    return true;
  }
}

export function rememberLandingPopupDismissed(
  storage: PopupStorage | null | undefined,
): void {
  if (!storage) return;

  try {
    storage.setItem(LANDING_POPUP_SESSION_KEY, "1");
  } catch {
    // Storage can be unavailable in private browsing or locked-down webviews.
  }
}

export function LandingPopup({
  forceOpen = false,
  path,
}: {
  forceOpen?: boolean;
  path: string;
}) {
  const [open, setOpen] = useState(forceOpen);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const isPublicPath = isPublicLandingPopupPath(path);

  const closePopup = useCallback(() => {
    if (!forceOpen) {
      rememberLandingPopupDismissed(window.sessionStorage);
    }
    setOpen(false);
    window.setTimeout(() => previousFocusRef.current?.focus(), 0);
  }, [forceOpen]);

  useEffect(() => {
    if (forceOpen || !isPublicPath || !shouldShowLandingPopup(window.sessionStorage)) {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const openTimer = window.setTimeout(() => setOpen(true), 0);

    return () => window.clearTimeout(openTimer);
  }, [forceOpen, isPublicPath]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePopup();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closePopup, open]);

  if (!isPublicPath) {
    return null;
  }

  if (!open) {
    return <span data-landing-popup-root hidden />;
  }

  return (
    <div
      className="landing-popup-overlay"
      data-landing-popup-root
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closePopup();
        }
      }}
    >
      <article
        aria-label={LANDING_POPUP_CONTENT.alt}
        aria-modal="true"
        className="landing-popup-modal"
        role="dialog"
      >
        <button
          aria-label={LANDING_POPUP_CONTENT.closeLabel}
          className="landing-popup-close"
          onClick={closePopup}
          ref={closeButtonRef}
          type="button"
        >
          ×
        </button>
        <Image
          alt={LANDING_POPUP_CONTENT.alt}
          className="landing-popup-image"
          height={LANDING_POPUP_CONTENT.height}
          priority
          sizes="(max-width: 680px) calc(100vw - 24px), 800px"
          src={LANDING_POPUP_CONTENT.src}
          width={LANDING_POPUP_CONTENT.width}
        />
      </article>
    </div>
  );
}
