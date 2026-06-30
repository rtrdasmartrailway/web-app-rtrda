"use client";

import { useEffect, useId, useState } from "react";
import {
  type BoardExecutiveDetailEntry,
  getBoardExecutiveDetailByName,
  getBoardExecutiveDetailByTrigger,
} from "@/lib/wp/board-executive-details";
import styles from "./board-executive-org-chart.module.css";

const LEGACY_IGNORED_CLASSES = new Set([
  "wp-block-button",
  "detail-btn",
  "is-style-fill",
]);

function BoardExecutiveDetailModal({
  detail,
  labelledBy,
  onClose,
}: {
  detail: BoardExecutiveDetailEntry;
  labelledBy: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className={styles.detailOverlay} role="presentation" onClick={onClose}>
      <section
        aria-labelledby={labelledBy}
        aria-modal="true"
        className={styles.detailModal}
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          aria-label="ปิดรายละเอียด"
          className={styles.detailClose}
          type="button"
          onClick={onClose}
        >
          ×
        </button>
        <div
          className={styles.detailBody}
          id={labelledBy}
          dangerouslySetInnerHTML={{ __html: detail.html }}
        />
      </section>
    </div>
  );
}

export function BoardExecutiveDetailButton({ name }: { name: string }) {
  const detail = getDetailByDisplayedName(name);
  const [open, setOpen] = useState(false);
  const headingId = useId();

  if (!detail) {
    return (
      <button className={styles.detailButtonDisabled} disabled type="button">
        รายละเอียด
      </button>
    );
  }

  return (
    <>
      <button
        aria-controls={open ? headingId : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={styles.detailButton}
        type="button"
        onClick={() => setOpen(true)}
      >
        รายละเอียด
      </button>
      {open ? (
        <BoardExecutiveDetailModal
          detail={detail}
          labelledBy={headingId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function legacyDetailFromElement(element: Element): BoardExecutiveDetailEntry | null {
  for (const className of Array.from(element.classList)) {
    if (LEGACY_IGNORED_CLASSES.has(className)) {
      continue;
    }

    const detail = getBoardExecutiveDetailByTrigger(className);
    if (detail) {
      return detail;
    }
  }

  return null;
}

function getDetailByDisplayedName(name: string): BoardExecutiveDetailEntry | null {
  if (name.includes("เพียงออ") && name.includes("เลาหะวิไลย")) {
    return (
      getBoardExecutiveDetailByTrigger("peangau") ?? getBoardExecutiveDetailByName(name)
    );
  }

  return getBoardExecutiveDetailByName(name);
}

function findLegacyDetailForColumn(column: Element): BoardExecutiveDetailEntry | null {
  const name = column.querySelector("h4")?.textContent ?? "";
  return getDetailByDisplayedName(name);
}

function enableLegacyButton(element: Element) {
  const wrapper = element.closest(".wp-block-button") ?? element;
  const link = wrapper.querySelector("a");
  wrapper.classList.remove("detail-btn-disabled");
  wrapper.removeAttribute("aria-disabled");
  link?.removeAttribute("aria-disabled");
  link?.removeAttribute("tabindex");
}

function disableLegacyButton(element: Element) {
  const wrapper = element.closest(".wp-block-button") ?? element;
  const link = wrapper.querySelector("a");
  wrapper.classList.add("detail-btn-disabled");
  wrapper.setAttribute("aria-disabled", "true");
  link?.removeAttribute("href");
  link?.setAttribute("aria-disabled", "true");
  link?.setAttribute("tabindex", "-1");
}

function legacyButtonMarkup(enabled: boolean): string {
  const disabledAttributes = enabled ? "" : ' aria-disabled="true" tabindex="-1"';
  const disabledClass = enabled ? "" : " detail-btn-disabled";

  return `<div class="wp-block-buttons is-content-justification-center is-layout-flex board-detail-button-injected"><div class="wp-block-button detail-btn${disabledClass}"><a class="wp-block-button__link wp-element-button"${disabledAttributes}>รายละเอียด</a></div></div>`;
}

export function BoardExecutiveLegacyDetailsHydrator() {
  const [activeDetail, setActiveDetail] = useState<BoardExecutiveDetailEntry | null>(
    null,
  );
  const headingId = useId();

  useEffect(() => {
    const columns = Array.from(
      document.querySelectorAll(".content-board-executives .wp-block-column"),
    );

    for (const column of columns) {
      const role = column.querySelector("h5")?.textContent?.trim();
      if (!role) {
        continue;
      }

      const button = column.querySelector(".detail-btn");
      const detail =
        (button ? legacyDetailFromElement(button) : null) ??
        findLegacyDetailForColumn(column);

      if (button && detail) {
        enableLegacyButton(button);
      }

      if (button && !detail) {
        disableLegacyButton(button);
      }

      if (!button) {
        column.insertAdjacentHTML("beforeend", legacyButtonMarkup(Boolean(detail)));
      }
    }

    function onClick(event: MouseEvent) {
      const target = event.target as Element | null;
      const button = target?.closest(".content-board-executives .detail-btn");
      if (!button) {
        return;
      }

      const column = button.closest(".wp-block-column");
      const detail =
        legacyDetailFromElement(button) ??
        (column ? findLegacyDetailForColumn(column) : null);
      if (!detail) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      setActiveDetail(detail);
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return activeDetail ? (
    <BoardExecutiveDetailModal
      detail={activeDetail}
      labelledBy={headingId}
      onClose={() => setActiveDetail(null)}
    />
  ) : null;
}
