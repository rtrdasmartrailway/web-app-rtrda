import Link from "next/link";
import type { ShellData } from "@/lib/db/page-data";
import { RtrdaNavigation } from "./rtrda-navigation";
import { formatDate } from "./site-helpers";

export function SiteShell({
  children,
  shell,
}: {
  children: React.ReactNode;
  shell: ShellData;
}) {
  const { language } = shell;
  const generatedDate = formatDate(shell.generatedAt, language);

  return (
    <div className="site-shell">
      <RtrdaNavigation
        alternatePath={shell.alternatePath}
        language={language}
        navItems={shell.navItems}
      />

      <main>{children}</main>

      <footer className="site-footer">
        <div className="footer-topline" />
        <div className="site-container footer-grid">
          <section className="footer-brand">
            {/* Use a plain <img> with the legacy absolute URL — the
                Next.js image optimizer can't proxy www.rtrda.or.th
                (no `images.domains` configured) and the file isn't
                in the Docker image (public/wp-content/uploads is
                gitignored), so any `/_next/image?...` request 400s.
                The legacy host serves it fine. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://www.rtrda.or.th/wp-content/uploads/2023/02/Logo_RTRDA_full-1.png"
              alt="RTRDA"
              width={220}
              height={62}
              loading="lazy"
            />
            <h2>
              {language === "th"
                ? "สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง"
                : "Rail Technology Research and Development Agency"}
            </h2>
            <p>
              {language === "th"
                ? "หน่วยงานวิจัยและพัฒนาเทคโนโลยีระบบราง เพื่อยกระดับระบบรางไทยอย่างยั่งยืน"
                : "Research and development for Thailand rail technology and sustainable rail systems."}
            </p>
            <p className="freshness">
              {language === "th" ? "ข้อมูลปรับปรุงล่าสุด" : "Last updated"}:{" "}
              {generatedDate}
            </p>
          </section>
          <section>
            <h2>{language === "th" ? "หน่วยงานภาครัฐ" : "Government Agencies"}</h2>
            <ul>
              <li>
                <a href="https://www.mot.go.th" rel="noreferrer">
                  {language === "th" ? "กระทรวงคมนาคม" : "Ministry of Transport"}
                </a>
              </li>
              <li>
                <a href="https://www.drt.go.th" rel="noreferrer">
                  {language === "th"
                    ? "กรมการขนส่งทางราง"
                    : "Department of Rail Transport"}
                </a>
              </li>
              <li>
                <a href="https://www.railway.co.th" rel="noreferrer">
                  {language === "th"
                    ? "การรถไฟแห่งประเทศไทย"
                    : "State Railway of Thailand"}
                </a>
              </li>
            </ul>
          </section>
          <section>
            <h2>{language === "th" ? "เมนูหลัก" : "Quick Links"}</h2>
            <ul>
              {shell.footerNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2>{language === "th" ? "ติดต่อ" : "Contact Us"}</h2>
            <p>
              99 กระทรวงคมนาคม ถนนราชดำเนินนอก แขวงวัดโสมนัส เขตป้อมปราบศัตรูพ่าย กรุงเทพฯ
            </p>
            <p>
              <a href="mailto:info@rtrda.or.th">info@rtrda.or.th</a>
            </p>
            <p>
              <a href="tel:0822042998">082 204 2998</a>
            </p>
          </section>
        </div>
        <div className="footer-bottom">
          <div className="site-container">
            © 2024 Rail Technology Research and Development Agency (RTRDA). All Rights
            Reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
