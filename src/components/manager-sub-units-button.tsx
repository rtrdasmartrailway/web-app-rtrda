"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MANAGER_SUB_UNITS_BUTTON_LABEL,
  MANAGER_SUB_UNITS_HEADING,
  getManagerSubUnits,
} from "@/lib/wp/manager-sub-units";
import type { WpLanguage } from "@/lib/wp/types";

type DialogState = {
  role: string;
  titleId: string;
};

function buttonLabel(language: WpLanguage): string {
  return language === "th" ? MANAGER_SUB_UNITS_BUTTON_LABEL : "More";
}

function closeLabel(language: WpLanguage): string {
  return language === "th" ? "ปิดหน้าต่าง" : "Close";
}

export function ManagerSubUnitsButton({
  role,
  language,
}: {
  role: string;
  language: WpLanguage;
}) {
  const subUnits = getManagerSubUnits(role);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const closeDialog = useCallback(() => {
    setDialog(null);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!dialog) return;

    const previousOverflow = document.body.style.overflow;
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDialog();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dialog, closeDialog]);

  if (!subUnits || subUnits.length === 0) {
    return null;
  }

  const openDialog = () => {
    setDialog({
      role,
      titleId: `manager-sub-units-${role.replace(/\s+/g, "-")}`,
    });
  };

  const isOpen = dialog?.role === role;

  return (
    <>
      <button
        type="button"
        className="manager-sub-units-trigger"
        onClick={openDialog}
        ref={triggerRef}
      >
        {buttonLabel(language)}
      </button>
      {isOpen ? (
        <div
          aria-labelledby={dialog?.titleId}
          aria-modal="true"
          className="manager-sub-units-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeDialog();
            }
          }}
          role="dialog"
        >
          <article className="manager-sub-units-modal">
            <button
              aria-label={closeLabel(language)}
              className="manager-sub-units-close"
              onClick={closeDialog}
              ref={closeButtonRef}
              type="button"
            >
              ×
            </button>
            <h2 className="manager-sub-units-title" id={dialog?.titleId}>
              {MANAGER_SUB_UNITS_HEADING}
            </h2>
            <p className="manager-sub-units-role">{role}</p>
            <ol className="manager-sub-units-list">
              {subUnits.map((unit, index) => (
                <li key={`${role}-${index}`}>{unit}</li>
              ))}
            </ol>
          </article>
        </div>
      ) : null}
    </>
  );
}
