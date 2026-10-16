"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./pr-center-app.module.css";

export function PrCenterDialog({
  title,
  onClose,
  language,
  children,
}: {
  title: string;
  onClose: () => void;
  language: "th" | "en";
  children: React.ReactNode;
}) {
  const root = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  const id = useId();
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close.current();
      }
      if (event.key !== "Tab") return;
      const nodes = Array.from(
        root.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]',
        ) ?? [],
      ).filter((node) => node.getClientRects().length > 0);
      const first = nodes[0],
        last = nodes.at(-1);
      if (!first || !last) {
        event.preventDefault();
        root.current?.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first ||
          !root.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !root.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("keydown", key, true);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(
    <div className={`${styles.app} ${styles.workspaceDialogBackdrop}`}>
      <section
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        className={styles.workspaceDialog}
      >
        <header className={styles.workspaceDialogHeader}>
          <h2 id={id}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={language === "th" ? "ปิดรายละเอียดงาน" : "Close task details"}
          >
            ✕
          </button>
        </header>
        <div className={styles.workspaceDialogBody}>{children}</div>
      </section>
    </div>,
    document.body,
  );
}
