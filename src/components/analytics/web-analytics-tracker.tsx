"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  classifyTarget,
  isTrackablePath,
  normalizeAnalyticsPath,
  type AnalyticsEventType,
} from "@/lib/analytics/event-contract";
import { browserSession } from "@/lib/analytics/browser-session";
import { activityPath, publicActivityPath } from "@/lib/analytics/activity-contract";
import {
  outboundFormTarget,
  outboundSourceAllowed,
  supportedActivation,
} from "@/lib/analytics/outbound-form";

const ENDPOINT = "/api/analytics/events";
let lastPagePath: string | null = null;

function sessionId(): string {
  try {
    return browserSession(sessionStorage);
  } catch {
    return browserSession({ getItem: () => null, setItem: () => {} });
  }
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
    if (!path || !isTrackablePath(path) || !publicActivityPath(path)) {
      lastPagePath = null;
      return;
    }
    if (lastPagePath === path) return;
    lastPagePath = path;
    send("page_view", path);
  }, [pathname]);

  useEffect(() => {
    const observed = new WeakSet<Event>();
    function onClick(event: MouseEvent) {
      if (!supportedActivation(event) || observed.has(event)) return;
      observed.add(event);
      const anchor =
        event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      let url: URL;
      try {
        url = new URL(anchor.href, location.href);
      } catch {
        return;
      }
      const current = activityPath(location.pathname);
      const form = outboundFormTarget(url);
      if (form && current && outboundSourceAllowed(current)) {
        send("outbound_form_click", current, form);
        return;
      }
      if (url.origin !== location.origin) return;
      const target = normalizeAnalyticsPath(url.pathname);
      if (
        !current ||
        !target ||
        !isTrackablePath(current) ||
        !isTrackablePath(target) ||
        !publicActivityPath(current) ||
        !publicActivityPath(target)
      )
        return;
      send(classifyTarget(target), current, target);
    }
    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("auxclick", onClick, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("auxclick", onClick, { capture: true });
    };
  }, []);

  return null;
}
