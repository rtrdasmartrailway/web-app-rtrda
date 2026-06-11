"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { NAV } from "@/data/intranet";

const SOCIAL = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/rtrda.thailand/",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    ),
  },
  {
    label: "Twitter / X",
    href: "https://twitter.com/RtrdaT",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/rail-technology-research-and-development-agency/",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@rtrda.thailand",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z" />
      </svg>
    ),
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/channel/UC_bEnCUi9VXjB6s7OvtLPzg",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.97C5.12 20 12 20 12 20s6.88 0 8.59-.45a2.78 2.78 0 0 0 1.95-1.97A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58zM9.75 15.02V8.98L15.5 12z" />
      </svg>
    ),
  },
];

export function IntranetSidebar() {
  const [open, setOpen] = useState(false);
  const portalTarget = typeof document === "undefined" ? null : document.body;

  // Lock background scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Hamburger button stays in the header */}
      <button
        type="button"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="ml-auto flex h-10 w-10 flex-shrink-0 cursor-pointer flex-col justify-center gap-[5px] p-2"
      >
        <span className="block h-0.5 w-[22px] rounded bg-white" />
        <span className="block h-0.5 w-[22px] rounded bg-white" />
        <span className="block h-0.5 w-[22px] rounded bg-white" />
      </button>

      {/* Drawer is portaled to <body> so it overlays every other component. */}
      {portalTarget &&
        createPortal(
          <div
            aria-hidden={!open}
            className={`fixed inset-0 z-[1000] ${open ? "" : "pointer-events-none"}`}
          >
            {/* Backdrop */}
            <div
              onClick={() => setOpen(false)}
              aria-hidden="true"
              className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
                open ? "opacity-100" : "opacity-0"
              }`}
            />

            {/* Right-side drawer panel */}
            <aside
              aria-label="Navigation sidebar"
              className={`absolute right-0 top-0 flex h-[100dvh] w-[280px] max-w-[85vw] flex-col overflow-hidden border-l border-[#d9e1ea] bg-white shadow-2xl [font-family:'Amiko',sans-serif] transition-transform duration-300 ease-out ${
                open ? "translate-x-0" : "translate-x-full"
              }`}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="m-3 ml-auto flex h-11 w-11 cursor-pointer items-center justify-center text-[#003b79]/80 transition-colors hover:text-[#003b79]"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>

              {/* Scrollable nav */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                <nav aria-label="Mobile Navigation">
                  <ul className="list-none p-0 pb-4">
                    {NAV.map((group) => (
                      <li key={group.label} className="border-b border-[#d9e1ea]">
                        <span className="block px-6 pb-1.5 pt-3 text-[13px] font-bold uppercase tracking-wider text-[#003b79]">
                          {group.label}
                        </span>
                        <ul className="list-none pb-2">
                          {group.children.map((item) => (
                            <li key={item.label}>
                              <a
                                href={item.href}
                                className="block px-6 py-2 text-[13px] text-[#1d2733] transition-colors hover:bg-[#f5f8fb] hover:text-[#003b79]"
                                target={item.href !== "#" ? "_blank" : undefined}
                                rel={
                                  item.href !== "#" ? "noopener noreferrer" : undefined
                                }
                                onClick={() => setOpen(false)}
                              >
                                {item.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>

              {/* Social links pinned at the bottom */}
              <div className="flex flex-shrink-0 items-center gap-3 border-t border-[#d9e1ea] px-6 py-4">
                {SOCIAL.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="text-[#003b79]/80 transition-colors hover:text-[#003b79]"
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            </aside>
          </div>,
          portalTarget,
        )}
    </>
  );
}
