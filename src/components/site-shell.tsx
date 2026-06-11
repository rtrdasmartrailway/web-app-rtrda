import Link from "next/link";
import Image from "next/image";
import type { WpImportManifest } from "@/lib/wp/types";
import { getNavigationTree } from "@/lib/wp/content-store";
import { buildPrimaryNavigation } from "@/lib/wp/presentation";
import { RtrdaNavigation } from "./rtrda-navigation";
import { counterpartPath, currentLanguage, formatDate } from "./site-helpers";

export function SiteShell({
  children,
  manifest,
  path,
}: {
  children: React.ReactNode;
  manifest: WpImportManifest;
  path: string;
}) {
  const language = currentLanguage(path);
  const generatedDate = formatDate(manifest.generatedAt, language);
  const alternate = counterpartPath(manifest, path, language);
  const navigationTree = getNavigationTree(manifest.records, language).slice(0, 8);
  const navItems = buildPrimaryNavigation(
    manifest.records,
    language,
    path,
    manifest.navigation?.[language],
  );

  return (
    <div className="site-shell">
      <RtrdaNavigation
        alternatePath={alternate}
        language={language}
        navItems={navItems}
      />

      <main>{children}</main>

      <footer className="site-footer">
        <div className="footer-topline" />
        <div className="site-container footer-grid">
          <section className="footer-brand">
            <Image
              src="/wp-content/uploads/2023/02/Logo_RTRDA_full-1.png"
              alt="RTRDA"
              width={220}
              height={62}
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
              {language === "th" ? "ข้อมูลนำเข้าล่าสุด" : "Imported"}: {generatedDate}
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
              {navigationTree.map((item) => (
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
