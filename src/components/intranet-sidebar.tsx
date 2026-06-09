"use client";

import { useState } from "react";
import { NAV } from "@/data/intranet";

const SOCIAL = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/rtrda.thailand/",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
      </svg>
    ),
  },
  {
    label: "Twitter / X",
    href: "https://twitter.com/RtrdaT",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/rail-technology-research-and-development-agency/",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/>
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@rtrda.thailand",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/>
      </svg>
    ),
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/channel/UC_bEnCUi9VXjB6s7OvtLPzg",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.97C5.12 20 12 20 12 20s6.88 0 8.59-.45a2.78 2.78 0 0 0 1.95-1.97A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58zM9.75 15.02V8.98L15.5 12z"/>
      </svg>
    ),
  },
];

export function IntranetSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Hamburger button in header */}
      <button
        className="intranet-hamburger"
        aria-label="Toggle sidebar & navigation"
        onClick={() => setOpen(true)}
      >
        <span className="intranet-hamburger-bar" />
        <span className="intranet-hamburger-bar" />
        <span className="intranet-hamburger-bar" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="intranet-sidebar-backdrop"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Slide-out panel */}
      <aside
        className={`intranet-sidebar${open ? " intranet-sidebar--open" : ""}`}
        aria-label="Navigation sidebar"
      >
        {/* Close button */}
        <button
          className="intranet-sidebar-close"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        >
          <span className="intranet-hamburger-bar" />
          <span className="intranet-hamburger-bar" />
          <span className="intranet-hamburger-bar" />
        </button>

        {/* Mobile nav — scrollable */}
        <div className="intranet-sidenav-scroll">
          <nav aria-label="Mobile Navigation">
            <ul className="intranet-sidenav-list">
              {NAV.map((group) => (
                <li key={group.label} className="intranet-sidenav-group">
                  <span className="intranet-sidenav-heading">{group.label}</span>
                  <ul className="intranet-sidenav-children">
                    {group.children.map((item) => (
                      <li key={item.label}>
                        <a
                          href={item.href}
                          className="intranet-sidenav-link"
                          target={item.href !== "#" ? "_blank" : undefined}
                          rel={item.href !== "#" ? "noopener noreferrer" : undefined}
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

        {/* Social links — always visible at bottom */}
        <div className="intranet-sidebar-social">
          {SOCIAL.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="intranet-social-link"
              aria-label={s.label}
            >
              {s.icon}
            </a>
          ))}
        </div>
      </aside>
    </>
  );
}
