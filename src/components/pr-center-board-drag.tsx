"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { BOARD_COLUMNS, type BoardColumn } from "@/lib/pr-center/board-moves";
import styles from "./pr-center-app.module.css";

type DragItem = { id: string; title: string };
type Options = {
  onStart: (id: string) => void;
  onHover: (column: BoardColumn | null) => void;
  onFinish: () => void;
  onDrop: (id: string, column: BoardColumn) => void;
};

/** Pointer events handle mouse, pen and touch uniformly, without native HTML drag. */
export function useBoardHoldDrag(options: Options) {
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  }, [options]);
  const cleanup = useRef<(() => void) | null>(null);
  const [preview, setPreview] = useState<{ title: string; x: number; y: number } | null>(
    null,
  );
  useEffect(() => () => cleanup.current?.(), []);

  const start = (
    event: ReactPointerEvent<HTMLElement>,
    item: DragItem,
    enabled: boolean,
  ) => {
    if (
      !enabled ||
      !event.isPrimary ||
      event.button !== 0 ||
      (event.target as HTMLElement).closest("button, select, input, textarea, a, label")
    )
      return;
    cleanup.current?.();
    const element = event.currentTarget;
    const pointerId = event.pointerId;
    const initial = { x: event.clientX, y: event.clientY };
    let x = initial.x,
      y = initial.y;
    let active = false,
      finished = false;
    let frame = 0;
    let column: BoardColumn | null = null;
    const board = element.closest<HTMLElement>("[data-operations-board]");
    const locate = () => {
      const target = document
        .elementFromPoint(x, y)
        ?.closest<HTMLElement>("[data-board-column]");
      const value =
        target && board?.contains(target) ? target.dataset.boardColumn : undefined;
      const next = BOARD_COLUMNS.includes(value as BoardColumn)
        ? (value as BoardColumn)
        : null;
      if (next !== column) {
        column = next;
        callbacks.current.onHover(next);
      }
    };
    const finish = (drop: boolean) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", cancel);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("blur", cancel);
      element.removeEventListener("lostpointercapture", cancel);
      if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
      if (active) {
        document.body.style.userSelect = selection;
        setPreview(null);
        callbacks.current.onFinish();
        if (drop && column) callbacks.current.onDrop(item.id, column);
      }
      cleanup.current = null;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      x = e.clientX;
      y = e.clientY;
      if (!active) {
        if (Math.hypot(x - initial.x, y - initial.y) > 20) finish(false);
        return;
      }
      e.preventDefault();
      locate();
      setPreview({ title: item.title, x, y });
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId === pointerId) {
        x = e.clientX;
        y = e.clientY;
        if (active) {
          e.preventDefault();
          locate();
        }
        finish(true);
      }
    };
    const cancel = () => finish(false);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        finish(false);
      }
    };
    const selection = document.body.style.userSelect;
    const animate = () => {
      if (!active || finished) return;
      const rect = board?.getBoundingClientRect();
      if (board && rect && y >= rect.top && y <= rect.bottom) {
        const left = Math.max(0, rect.left),
          right = Math.min(window.innerWidth, rect.right);
        if (x < left + 48) board.scrollLeft -= 12;
        else if (x > right - 48) board.scrollLeft += 12;
      }
      if (y < 72) window.scrollBy(0, -14);
      else if (y > window.innerHeight - 72) window.scrollBy(0, 14);
      locate();
      frame = requestAnimationFrame(animate);
    };
    const timer = window.setTimeout(() => {
      if (finished || !element.isConnected) return finish(false);
      active = true;
      element.setPointerCapture(pointerId);
      document.body.style.userSelect = "none";
      callbacks.current.onStart(item.id);
      setPreview({ title: item.title, x, y });
      locate();
      frame = requestAnimationFrame(animate);
    }, 100);
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", up, { passive: false });
    document.addEventListener("pointercancel", cancel);
    document.addEventListener("keydown", key, true);
    element.addEventListener("lostpointercapture", cancel);
    window.addEventListener("blur", cancel);
    cleanup.current = () => finish(false);
  };
  const ghost = preview
    ? createPortal(
        <div
          className={styles.boardDragPreview}
          aria-hidden="true"
          style={{
            left: Math.max(8, Math.min(preview.x + 14, window.innerWidth - 208)),
            top: Math.max(8, Math.min(preview.y + 14, window.innerHeight - 92)),
          }}
        >
          {preview.title}
        </div>,
        document.body,
      )
    : null;
  return { onPointerDown: start, ghost };
}
