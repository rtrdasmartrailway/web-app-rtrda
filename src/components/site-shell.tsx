import Link from "next/link";
import { FooterUtility } from "./footer-utility";
import { LandingPopup } from "./landing-popup";
import { SafeImage } from "./safe-image";
import type { ShellData } from "@/lib/db/page-data";
import { RtrdaNavigation } from "./rtrda-navigation";
import { formatDate } from "./site-helpers";

/**
 * Static lists sourced from the legacy WordPress footer
 * (https://www.rtrda.or.th/). These are external government
 * agencies / state enterprises under the Ministry of Transport —
 * they are not pages on the RTRDA site, just outbound links.
 */
const GOV_AGENCIES_TH = [
  { label: "กระทรวงคมนาคม (คค.)", href: "https://www.mot.go.th" },
  { label: "กรมเจ้าท่า (จท.)", href: "https://md.go.th" },
  { label: "กรมการขนส่งทางบก (ขบ.)", href: "https://www.dlt.go.th" },
  { label: "กรมท่าอากาศยาน (ทย.)", href: "https://www.airports.go.th" },
  { label: "กรมทางหลวง (ทล.)", href: "https://www.doh.go.th" },
  { label: "กรมทางหลวงชนบท (ทช.)", href: "https://www.drr.go.th" },
  { label: "สำนักงานนโยบายและแผนการขนส่งและจราจร (สนข.)", href: "https://www.otp.go.th" },
  { label: "กรมการขนส่งทางราง (ขร.)", href: "https://www.drt.go.th" },
  { label: "สำนักงานการบินพลเรือนแห่งประเทศไทย (กพท.)", href: "https://www.caat.or.th" },
];
const RELATED_AGENCIES_TH = [
  { label: "สำนักงานการบินพลเรือนแห่งประเทศไทย (กพท.)", href: "https://www.caat.or.th" },
];
const STATE_ENTERPRISES_TH = [
  { label: "การรถไฟแห่งประเทศไทย (รฟท.)", href: "https://www.railway.co.th" },
  { label: "บริษัท รถไฟฟ้า ร.ฟ.ท. จำกัด (รฟฟท.)", href: "https://www.srtet.co.th/th" },
  { label: "การท่าเรือแห่งประเทศไทย (กทท.)", href: "https://www.port.co.th" },
  { label: "การรถไฟฟ้าขนส่งมวลชนแห่งประเทศไทย (รฟม.)", href: "http://www.mrta.co.th" },
  { label: "การทางพิเศษแห่งประเทศไทย (กทพ.)", href: "https://www.exat.co.th" },
  { label: "องค์การขนส่งมวลชนกรุงเทพ (ขสมก.)", href: "http://www.bmta.co.th" },
  { label: "สถาบันการบินพลเรือน (สบพ.)", href: "https://www.catc.or.th" },
  { label: "บริษัท ขนส่ง จำกัด (บขส.)", href: "http://www.transport.co.th" },
  {
    label: "บริษัท ท่าอากาศยานไทย จำกัด (มหาชน) (ทอท.)",
    href: "https://www.airportthai.co.th",
  },
  {
    label: "บริษัท วิทยุการบินแห่งประเทศไทย จำกัด (บวท.)",
    href: "https://www.aerothai.co.th",
  },
  {
    label: "บริษัท โรงแรมท่าอากาศยานสุวรรณภูมิ จำกัด (รทส.)",
    href: "http://www.suvarnabhumihotel.co.th",
  },
  { label: "บริษัท เอสอาร์ที แอสเสท จำกัด (อทส.)", href: "https://srtasset.com" },
];

const GOV_AGENCIES_EN = [
  { label: "Ministry of Transport (MOT)", href: "https://www.mot.go.th" },
  { label: "Marine Department (MD)", href: "https://md.go.th" },
  { label: "Department of Land Transport (DLT)", href: "https://www.dlt.go.th" },
  { label: "Department of Airports (DOA)", href: "https://www.airports.go.th" },
  { label: "Department of Highways (DOH)", href: "https://www.doh.go.th" },
  { label: "Department of Rural Roads (DRR)", href: "https://www.drr.go.th" },
  {
    label: "Office of Transport and Traffic Policy and Planning (OTP)",
    href: "https://www.otp.go.th",
  },
  { label: "Department of Rail Transport (DRT)", href: "https://www.drt.go.th" },
  {
    label: "Civil Aviation Authority of Thailand (CAAT)",
    href: "https://www.caat.or.th",
  },
];
const RELATED_AGENCIES_EN = [
  {
    label: "Civil Aviation Authority of Thailand (CAAT)",
    href: "https://www.caat.or.th",
  },
];
const STATE_ENTERPRISES_EN = [
  { label: "State Railway of Thailand (SRT)", href: "https://www.railway.co.th" },
  {
    label: "SRT Electrified Train Co., Ltd. (SRTET)",
    href: "https://www.srtet.co.th/th",
  },
  { label: "Port Authority of Thailand (PAT)", href: "https://www.port.co.th" },
  {
    label: "Mass Rapid Transit Authority of Thailand (MRTA)",
    href: "http://www.mrta.co.th",
  },
  { label: "Expressway Authority of Thailand (EXAT)", href: "https://www.exat.co.th" },
  { label: "Bangkok Mass Transit Authority (BMTA)", href: "http://www.bmta.co.th" },
  { label: "Civil Aviation Training Center (CATC)", href: "https://www.catc.or.th" },
  { label: "Transport Co., Ltd. (BORORSOR)", href: "http://www.transport.co.th" },
  { label: "Airports of Thailand (AOT)", href: "https://www.airportthai.co.th" },
  {
    label: "Aeronautical Radio of Thailand (AEROTHAI)",
    href: "https://www.aerothai.co.th",
  },
  {
    label: "Suvarnabhumi Airport Hotel Co., Ltd. (SAH)",
    href: "http://www.suvarnabhumihotel.co.th",
  },
  { label: "SRT Asset Co., Ltd. (SRTAS)", href: "https://srtasset.com" },
];

export function SiteShell({
  children,
  shell,
}: {
  children: React.ReactNode;
  shell: ShellData;
}) {
  const { language } = shell;
  const generatedDate = formatDate(shell.generatedAt, language);
  const isEn = language === "en";
  const govAgencies = isEn ? GOV_AGENCIES_EN : GOV_AGENCIES_TH;
  const relatedAgencies = isEn ? RELATED_AGENCIES_EN : RELATED_AGENCIES_TH;
  const stateEnterprises = isEn ? STATE_ENTERPRISES_EN : STATE_ENTERPRISES_TH;

  return (
    <div className="site-shell">
      <RtrdaNavigation
        alternatePath={shell.alternatePath}
        language={language}
        navItems={shell.navItems}
      />
      <LandingPopup path={shell.path} />

      <main>{children}</main>

      <footer className="site-footer">
        <div className="footer-topline" />
        <div className="site-container footer-grid">
          {/* Column 1: Brand — address, email, phone, visitor placeholder */}
          <section className="footer-brand">
            <SafeImage
              src="/wp-content/uploads/2023/02/Logo_RTRDA_full-1.png"
              fallbackSrc="/stitch-assets/rail-network.png"
              alt="RTRDA"
              width={220}
              height={62}
            />
            <h2>
              {isEn
                ? "Rail Technology Research and Development Agency"
                : "สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน)"}
            </h2>
            <p>
              {isEn
                ? "Research and development for Thailand rail technology and sustainable rail systems."
                : "หน่วยงานวิจัยและพัฒนาเทคโนโลยีระบบราง เพื่อยกระดับระบบรางไทยอย่างยั่งยืน"}
            </p>
            <p className="freshness">
              {isEn ? "Last updated" : "ข้อมูลปรับปรุงล่าสุด"}: {generatedDate}
            </p>

            <address className="footer-address">
              {isEn ? (
                <>
                  Building of Expressway Authority of Thailand (EXAT), 111 Ratchadaphisek
                  Road (Rim Klong Bang Kapi), Bang Kapi Subdistrict, Huai Khwang District,
                  Bangkok 10310
                </>
              ) : (
                <>
                  อาคารศูนย์บริหารทางพิเศษ การทางพิเศษแห่งประเทศไทย (กทพ.) เลขที่ 111 ชั้น
                  10 ถนนริมคลองบางกะปิ แขวงบางกะปิ เขตห้วยขวาง กรุงเทพฯ 10310
                </>
              )}
            </address>

            <p className="footer-contact">
              <span>Email :</span>{" "}
              <a href="mailto:saraban@rtrda.or.th">saraban@rtrda.or.th</a>{" "}
              <span className="footer-contact-note">
                ({isEn ? "for official correspondence" : "สำหรับการรับ-ส่งหนังสือราชการ"})
              </span>
            </p>
            <p className="footer-contact">
              <span>Email :</span> <a href="mailto:info@rtrda.or.th">info@rtrda.or.th</a>{" "}
              <span className="footer-contact-note">
                (
                {isEn
                  ? "for inquiries and complaints"
                  : "สำหรับการติดต่อสอบถามข้อมูล และแจ้งเรื่องร้องเรียน"}
                )
              </span>
            </p>
            <p className="footer-contact">
              <span>TEL :</span> 082 204 2998{" "}
              <span className="footer-contact-note">{isEn ? "or" : "หรือ"}</span> 02 248
              2988
            </p>

            <div
              className="footer-visitor-counter"
              aria-label={isEn ? "Visitor statistics" : "สถิติผู้เข้าชม"}
            >
              <strong>{isEn ? "Visitors" : "ผู้เข้าชม"}</strong>
              <ul>
                <li>
                  <span>{isEn ? "Total" : "ทั้งหมด"}:</span> <strong>—</strong>
                </li>
                <li>
                  <span>{isEn ? "Today" : "วันนี้"}:</span> <strong>—</strong>
                </li>
                <li>
                  <span>{isEn ? "Yesterday" : "เมื่อวาน"}:</span> <strong>—</strong>
                </li>
              </ul>
              <p className="footer-visitor-counter-note">
                ({isEn ? "counter not yet wired up" : "รอเชื่อมต่อระบบนับ"})
              </p>
            </div>

            <FooterUtility alternatePath={shell.alternatePath} language={language} />
          </section>

          {/* Column 2: ส่วนราชการในสังกัดกระทรวงคมนาคม */}
          <section>
            <h2>{isEn ? "Government Agencies" : "ส่วนราชการในสังกัดกระทรวงคมนาคม"}</h2>
            <ul>
              {govAgencies.map((a) => (
                <li key={a.href}>
                  <a href={a.href} rel="noreferrer">
                    {a.label}
                  </a>
                </li>
              ))}
            </ul>

            <h2 className="footer-section-spaced">
              {isEn ? "Related Agencies" : "หน่วยงานที่เกี่ยวข้อง"}
            </h2>
            <ul>
              {relatedAgencies.map((a) => (
                <li key={a.href}>
                  <a href={a.href} rel="noreferrer">
                    {a.label}
                  </a>
                </li>
              ))}
            </ul>

            <h2 className="footer-section-spaced">
              {isEn ? "Service Network" : "เครือข่ายบริการ"}
            </h2>
            <ul>
              <li>
                <a
                  href="#"
                  rel="noreferrer"
                  target="_blank"
                >
                  {isEn ? "Terms of Use" : "ข้อกำหนดการใช้งาน"}
                </a>
              </li>
              <li>
                <a
                  href="/wp-content/uploads/2025/01/ประกาศ-สทร_นโยบายการคุ้มครองข้อมูลส่วนบุค.pdf"
                  rel="noreferrer"
                  target="_blank"
                >
                  {isEn ? "Privacy Policy" : "นโยบายการคุ้มครองข้อมูลส่วนบุคคล"}
                </a>
              </li>
              <li>
                <Link href={isEn ? "/en/แผนที่เว็บไซต์" : "/แผนที่เว็บไซต์"}>
                  {isEn ? "Sitemap" : "แผนที่เว็บไซต์"}
                </Link>
              </li>
              <li>
                <Link href={isEn ? "/en/e-services" : "/e-services"}>e-Services</Link>
              </li>
            </ul>
          </section>

          {/* Column 3: รัฐวิสาหกิจในสังกัดกระทรวงคมนาคม + เมนูหลัก */}
          <section>
            <h2>
              {isEn
                ? "State Enterprises under the Ministry of Transport"
                : "รัฐวิสาหกิจในสังกัดกระทรวงคมนาคม"}
            </h2>
            <ul>
              {stateEnterprises.map((a) => (
                <li key={a.href}>
                  <a href={a.href} rel="noreferrer">
                    {a.label}
                  </a>
                </li>
              ))}
            </ul>

            <h2 className="footer-section-spaced">{isEn ? "Quick Links" : "เมนูหลัก"}</h2>
            <ul>
              {shell.footerNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
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
