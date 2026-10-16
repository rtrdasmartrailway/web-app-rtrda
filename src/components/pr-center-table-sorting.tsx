"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_LIST_SORT,
  listSortFields,
  type ListSortKind,
} from "@/lib/pr-center/list-sorting";
import styles from "./pr-center-app.module.css";

export type TableSorting = {
  kind: ListSortKind;
  value: string;
  onChange: (value: string) => void;
  language: "th" | "en";
};

export function sortDirectionLabel(field: string, direction: string, thai: boolean) {
  const ascending = direction === "asc";
  if (field === "createdAt")
    return thai
      ? ascending
        ? "เก่า → ใหม่"
        : "ใหม่ → เก่า"
      : ascending
        ? "Oldest first"
        : "Newest first";
  if (field === "requestedFor")
    return thai
      ? ascending
        ? "วันที่ก่อน → หลัง"
        : "วันที่หลัง → ก่อน"
      : ascending
        ? "Earlier date first"
        : "Later date first";
  if (field === "priority")
    return thai
      ? ascending
        ? "สำคัญน้อย → มาก"
        : "สำคัญมาก → น้อย"
      : ascending
        ? "Low → High priority"
        : "High → Low priority";
  if (field === "status")
    return thai
      ? ascending
        ? "ตามลำดับขั้นงาน"
        : "ย้อนลำดับขั้นงาน"
      : ascending
        ? "Workflow order"
        : "Reverse workflow order";
  return thai
    ? ascending
      ? "ชื่อเรียงขึ้น · ก–ฮ / A–Z"
      : "ชื่อเรียงลง · ฮ–ก / Z–A"
    : ascending
      ? "Ascending · A–Z"
      : "Descending · Z–A";
}

export function SortableHeading({
  field,
  children,
  sorting,
}: {
  field: string;
  children: React.ReactNode;
  sorting: TableSorting;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const [activeField, direction] = sorting.value.split(":");
  const active = activeField === field;
  const thai = sorting.language === "th";
  const close = (focus = false) => {
    setOpen(false);
    if (focus) trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    menu.current
      ?.querySelector<HTMLButtonElement>('[aria-checked="true"], button')
      ?.focus();
    const dismiss = (event: PointerEvent) => {
      if (
        !menu.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    const move = () => setOpen(false);
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", move);
    // Close on table/page scroll, but allow scrolling inside the menu itself.
    const scroll = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", move);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [open]);
  const toggle = () => {
    if (open) return close(true);
    const rect = trigger.current!.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 288)),
      top:
        rect.bottom + 240 > window.innerHeight
          ? Math.max(8, rect.top - 224)
          : rect.bottom + 6,
    });
    setOpen(true);
  };
  return (
    <th
      scope="col"
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={active ? styles.sortedHeading : undefined}
    >
      <button
        ref={trigger}
        type="button"
        className={styles.sortTrigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            toggle();
          }
        }}
      >
        {children}
        <span aria-hidden="true">
          {active ? (direction === "asc" ? "↑" : "↓") : "↕"} ▾
        </span>
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="menu"
            aria-label={`${thai ? "เรียงตาม" : "Sort by"} ${String(children)}`}
            className={styles.sortMenu}
            style={position}
            onKeyDown={(event) => {
              const buttons = Array.from(
                menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
              );
              const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
              if (event.key === "Escape") {
                event.preventDefault();
                close(true);
              } else if (event.key === "Tab") close(true);
              else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                buttons[
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? buttons.length - 1
                      : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
                        buttons.length
                ]?.focus();
              }
            }}
          >
            <p>
              {thai ? "เรียงตาม" : "Sort by"} {children}
            </p>
            {["desc", "asc"].map((order) => (
              <button
                key={order}
                type="button"
                role="menuitemradio"
                aria-checked={active && direction === order}
                onClick={() => {
                  close(true);
                  if (!active || direction !== order)
                    sorting.onChange(`${field}:${order}`);
                }}
              >
                <span aria-hidden="true">{active && direction === order ? "✓" : ""}</span>
                {sortDirectionLabel(field, order, thai)}
              </button>
            ))}
            <button
              type="button"
              role="menuitem"
              className={styles.sortReset}
              onClick={() => {
                close(true);
                if (sorting.value !== DEFAULT_LIST_SORT)
                  sorting.onChange(DEFAULT_LIST_SORT);
              }}
            >
              {thai ? "คืนลำดับเริ่มต้น" : "Reset sorting"}
            </button>
          </div>,
          document.body,
        )}
    </th>
  );
}

export function TableSummary({
  sorting,
  count,
  hasMore,
}: {
  sorting: TableSorting;
  count: number;
  hasMore?: boolean;
}) {
  const [field, direction] = sorting.value.split(":");
  const thai = sorting.language === "th";
  const label = listSortFields[sorting.kind].find(([key]) => key === field);
  return (
    <div className={styles.tableSummary} role="status">
      <span>
        {thai
          ? `แสดง ${count} รายการ${hasMore ? " · มีรายการเพิ่มเติม" : ""}`
          : `${count} items shown${hasMore ? " · More available" : ""}`}
      </span>
      <span>
        {thai ? "เรียงตาม: " : "Sorted by: "}
        <strong>{label?.[thai ? 1 : 2]}</strong> ·{" "}
        {sortDirectionLabel(field, direction, thai)}
      </span>
      {sorting.value !== DEFAULT_LIST_SORT && (
        <button type="button" onClick={() => sorting.onChange(DEFAULT_LIST_SORT)}>
          {thai ? "คืนลำดับเริ่มต้น" : "Reset sorting"}
        </button>
      )}
    </div>
  );
}
