"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  classifyTarget,
  isTrackablePath,
  normalizeAnalyticsPath,
  type AnalyticsEventType,
} from "@/lib/analytics/event-contract";

const ENDPOINT = "/api/analytics/events";
let lastPagePath: string | null = null;

function sessionId(): string {
  const key = "rtrda_analytics_session";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(key, created);
  return created;
}

function source(): "direct" | "internal" | "external" {
  if (!document.referrer) return "direct";
  try {
    return new URL(document.referrer).origin === location.origin
      ? "internal"
      : "external";
  } catch {
    return "direct";
  }
}

function send(
  eventType: AnalyticsEventType,
  path: string,
  targetPath: string | null = null,
): void {
  const body = JSON.stringify({
    eventId: crypto.randomUUID(),
    eventType,
    path,
    targetPath,
    sessionId: sessionId(),
    source: source(),
  });
  const blob = new Blob([body], { type: "application/json" });
  if (navigator.sendBeacon?.(ENDPOINT, blob)) return;
  void fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => undefined);
}

export function WebAnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const path = normalizeAnalyticsPath(pathname);
    if (!path || !isTrackablePath(path) || lastPagePath === path) return;
    lastPagePath = path;
    send("page_view", path);
  }, [pathname]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const anchor =
        event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      let url: URL;
      try {
        url = new URL(anchor.href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin) return;
      const current = normalizeAnalyticsPath(location.pathname);
      const target = normalizeAnalyticsPath(url.pathname);
      if (!current || !target || !isTrackablePath(current) || !isTrackablePath(target))
        return;
      send(classifyTarget(target), current, target);
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
