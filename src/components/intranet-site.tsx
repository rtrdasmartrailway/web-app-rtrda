import Image from "next/image";
import { NAV, ICON_ROWS } from "@/data/intranet";
import type { IconItem } from "@/data/intranet";
import { IntranetSidebar } from "@/components/intranet-sidebar";

function NavMenu() {
  return (
    <nav className="intranet-nav" aria-label="Intranet Navigation">
      <ul className="intranet-nav-list">
        {NAV.map((group) => (
          <li key={group.label} className="intranet-nav-item">
            <a href={group.href} className="intranet-nav-link">
              {group.label}
              <svg
                className="intranet-nav-arrow"
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 21 32"
                aria-hidden="true"
              >
                <path d="M19.196 13.143q0 .232-.179.411l-8.321 8.321q-.179.179-.411.179t-.411-.179L1.553 13.554q-.179-.179-.179-.411t.179-.411l.893-.893q.179-.179.411-.179t.411.179l7.018 7.018 7.018-7.018q.179-.179.411-.179t.411.179l.893.893q.179.179.179.411z" />
              </svg>
            </a>
            <ul className="intranet-dropdown">
              {group.children.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className="intranet-dropdown-link"
                    target={item.href !== "#" ? "_blank" : undefined}
                    rel={item.href !== "#" ? "noopener noreferrer" : undefined}
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
  );
}

function IconGrid({ items, eager }: { items: IconItem[]; eager?: boolean }) {
  return (
    <div className="intranet-icon-row">
      {items.map((item, idx) => (
        <a
          key={item.img}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="intranet-icon-card"
        >
          <figure className="intranet-icon-figure">
            <Image
              src={item.img}
              alt={item.caption || ""}
              width={150}
              height={150}
              className="intranet-icon-img"
              priority={eager && idx === 0}
            />
            {item.caption && (
              <figcaption className="intranet-icon-caption">
                {item.caption}
              </figcaption>
            )}
          </figure>
        </a>
      ))}
    </div>
  );
}

export function IntranetShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="intranet-shell">
      <header className="intranet-header">
        <div className="intranet-header-inner">
          <a href="/intranet" className="intranet-logo-link">
            <Image
              src="/intranet/icons/White-logo-02.png"
              alt="RTRDA INTRANET"
              width={60}
              height={61}
              priority
              className="intranet-logo"
            />
          </a>
          <NavMenu />
          <IntranetSidebar />
        </div>
      </header>

      <main className="intranet-main">{children}</main>

      <footer className="intranet-footer">
        <p className="intranet-footer-text">
          RTRDA INTRANET &mdash; สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน)
        </p>
      </footer>
    </div>
  );
}

export function IntranetHome() {
  return (
    <div className="intranet-content">
      {ICON_ROWS.map((row, i) => (
        <section key={i} className="intranet-section">
          <IconGrid items={row} eager={i === 0} />
        </section>
      ))}
    </div>
  );
}
