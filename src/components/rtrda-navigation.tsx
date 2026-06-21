"use client";

import { SafeImage } from "./safe-image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { WpLanguage } from "@/lib/wp/types";
import type { PresentationNavItem } from "@/lib/wp/presentation";

function isHashOnly(item: PresentationNavItem): boolean {
  return !item.path && item.href.startsWith("#");
}

function NavigationLink({
  children,
  className,
  item,
}: {
  children?: ReactNode;
  className?: string;
  item: PresentationNavItem;
}) {
  const content = children ?? item.label;

  if (item.path) {
    return (
      <Link href={item.href} className={className}>
        {content}
      </Link>
    );
  }

  if (item.external) {
    return (
      <a href={item.href} className={className} rel="noreferrer" target="_blank">
        {content}
      </a>
    );
  }

  if (item.href && item.href !== "#") {
    return (
      <a href={item.href} className={className}>
        {content}
      </a>
    );
  }

  return (
    <button className={className} type="button">
      {content}
    </button>
  );
}

function DesktopDropdown({ items }: { items: PresentationNavItem[] }) {
  return (
    <div className="nav-dropdown">
      {items.map((child) =>
        child.children.length > 0 ? (
          <div className="nav-dropdown-group" key={`${child.href}-${child.label}`}>
            <NavigationLink
              item={child}
              className={child.active ? "active" : undefined}
            />
            <div className="nav-dropdown-nested">
              {child.children.map((grandchild) => (
                <NavigationLink
                  key={`${grandchild.href}-${grandchild.label}`}
                  item={grandchild}
                  className={grandchild.active ? "active" : undefined}
                />
              ))}
            </div>
          </div>
        ) : (
          <NavigationLink
            key={`${child.href}-${child.label}`}
            item={child}
            className={child.active ? "active" : undefined}
          />
        ),
      )}
    </div>
  );
}

function MobileNavItem({ item }: { item: PresentationNavItem }) {
  if (item.children.length > 0) {
    return (
      <details open={item.active}>
        <summary>
          <NavigationLink item={item} className={item.active ? "active" : undefined} />
          <span aria-hidden="true" className="nav-caret" />
        </summary>
        <div>
          {item.children.map((child) =>
            child.children.length > 0 ? (
              <details
                className="mobile-subdetails"
                key={`${child.href}-${child.label}`}
                open={child.active}
              >
                <summary>
                  <NavigationLink
                    item={child}
                    className={child.active ? "active" : undefined}
                  />
                  <span aria-hidden="true" className="nav-caret" />
                </summary>
                <div>
                  {child.children.map((grandchild) => (
                    <NavigationLink
                      key={`${grandchild.href}-${grandchild.label}`}
                      item={grandchild}
                      className={grandchild.active ? "active" : undefined}
                    />
                  ))}
                </div>
              </details>
            ) : (
              <NavigationLink
                key={`${child.href}-${child.label}`}
                item={child}
                className={child.active ? "active" : undefined}
              />
            ),
          )}
        </div>
      </details>
    );
  }

  return <NavigationLink item={item} className={item.active ? "active" : undefined} />;
}

export function RtrdaNavigation({
  alternatePath,
  language,
  navItems,
}: {
  alternatePath: string;
  language: WpLanguage;
  navItems: PresentationNavItem[];
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const homePath = language === "th" ? "/" : "/en";

  useEffect(() => {
    document.documentElement.style.setProperty("--reader-scale", String(fontScale));
  }, [fontScale]);

  return (
    <>
      <div className="utility-bar">
        <div className="site-container utility-inner">
          <div
            className="reader-controls"
            aria-label={language === "th" ? "ขนาดตัวอักษร" : "Font size"}
          >
            <span>{language === "th" ? "ขนาดตัวอักษร" : "Font Size"}</span>
            {[1, 1.08, 1.16].map((scale, index) => (
              <button
                key={scale}
                type="button"
                aria-pressed={fontScale === scale}
                onClick={() => setFontScale(scale)}
              >
                {"A".repeat(index + 1)}
              </button>
            ))}
          </div>
          <nav aria-label="Utility navigation">
            <Link href={language === "th" ? "/แผนที่เว็บไซต์" : "/en/แผนที่เว็บไซต์"}>
              {language === "th" ? "แผนที่เว็บไซต์" : "Sitemap"}
            </Link>
            <Link href={alternatePath}>{language === "th" ? "EN" : "TH"}</Link>
          </nav>
        </div>
      </div>

      <header className="site-header">
        <div className="site-container header-inner">
          <Link href={homePath} className="brand-link" aria-label="RTRDA home">
            <SafeImage
              src="/wp-content/uploads/2023/02/Logo_RTRDA_full-1.png"
              fallbackSrc="/stitch-assets/rail-network.png"
              alt="RTRDA"
              width={260}
              height={72}
              priority
            />
          </Link>

          <nav className="desktop-nav" aria-label="Primary navigation">
            {navItems.map((item) => (
              <div
                className={`nav-item ${item.active ? "active" : ""} ${item.children.length > 0 ? "has-dropdown" : ""}`}
                key={`${item.href}-${item.label}`}
              >
                <NavigationLink
                  item={item}
                  className={`nav-link ${isHashOnly(item) ? "is-placeholder" : ""}`}
                >
                  <span>{item.label}</span>
                  {item.children.length > 0 ? (
                    <span aria-hidden="true" className="nav-caret" />
                  ) : null}
                </NavigationLink>
                {item.children.length > 0 ? (
                  <DesktopDropdown items={item.children} />
                ) : null}
              </div>
            ))}
          </nav>

          <div className="header-actions">
            <button
              className="icon-button"
              type="button"
              aria-expanded={searchOpen}
              aria-controls="site-search-panel"
              onClick={() => setSearchOpen((open) => !open)}
            >
              <span className="search-icon" aria-hidden="true" />
              <span className="sr-only">{language === "th" ? "ค้นหา" : "Search"}</span>
            </button>
            <button
              className="mobile-menu-button"
              type="button"
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMobileOpen((open) => !open)}
            >
              <span aria-hidden="true" />
              <span className="sr-only">{language === "th" ? "เมนู" : "Menu"}</span>
            </button>
          </div>
        </div>

        <div
          className={`search-panel ${searchOpen ? "open" : ""}`}
          id="site-search-panel"
        >
          <form action="/search" className="site-search">
            <input
              name="q"
              type="search"
              placeholder={language === "th" ? "ค้นหา" : "Search"}
              aria-label={language === "th" ? "ค้นหา" : "Search"}
            />
            <button type="submit">{language === "th" ? "ค้นหา" : "Search"}</button>
          </form>
        </div>

        <nav
          className={`mobile-nav ${mobileOpen ? "open" : ""}`}
          id="mobile-navigation"
          aria-label="Mobile navigation"
        >
          <form action="/search" className="mobile-search">
            <input
              name="q"
              type="search"
              placeholder={language === "th" ? "ค้นหา" : "Search"}
              aria-label={language === "th" ? "ค้นหา" : "Search"}
            />
            <button type="submit">{language === "th" ? "ค้นหา" : "Search"}</button>
          </form>
          {navItems.map((item) => (
            <MobileNavItem item={item} key={`${item.href}-${item.label}`} />
          ))}
          <Link className="mobile-language" href={alternatePath}>
            {language === "th" ? "English" : "ภาษาไทย"}
          </Link>
        </nav>
      </header>
    </>
  );
}
