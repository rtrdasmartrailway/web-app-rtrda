import Link from "next/link";
import Image from "next/image";
import type { WpLanguage } from "@/lib/wp/types";

const PRIVACY_POLICY_PDF =
  "https://www.rtrda.or.th/wp-content/uploads/2025/01/%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%81%E0%B8%B2%E0%B8%A8-%E0%B8%AA%E0%B8%97%E0%B8%A3_%E0%B8%99%E0%B9%82%E0%B8%A2%E0%B8%9A%E0%B8%B2%E0%B8%A2%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%84%E0%B8%B8%E0%B9%89%E0%B8%A1%E0%B8%84%E0%B8%A3%E0%B8%AD%E0%B8%87%E0%B8%82%E0%B9%89%E0%B8%AD%E0%B8%A1%E0%B8%B9%E0%B8%A5%E0%B8%AA%E0%B9%88%E0%B8%A7%E0%B8%99%E0%B8%9A%E0%B8%B8%E0%B8%84.pdf";

const govAgencies = [
  { th: "กระทรวงคมนาคม (คค.)", en: "Ministry of Transport", url: "https://www.mot.go.th/" },
  { th: "กรมเจ้าท่า (จท.)", en: "Marine Department", url: "https://md.go.th/" },
  { th: "กรมการขนส่งทางบก (ขบ.)", en: "Department of Land Transport", url: "https://www.dlt.go.th/" },
  { th: "กรมท่าอากาศยาน (ทย.)", en: "Department of Airport", url: "https://www.airports.go.th/" },
  { th: "กรมทางหลวง (ทล.)", en: "Department of Highways", url: "https://www.doh.go.th/" },
  { th: "กรมทางหลวงชนบท (ทช.)", en: "Department of Rural Roads", url: "https://www.drr.go.th/" },
  { th: "สำนักงานนโยบายและแผนการขนส่งและจราจร (สนข.)", en: "Office of Transport and Traffic Policy and Planning", url: "https://www.otp.go.th/" },
  { th: "กรมการขนส่งทางราง (ขร.)", en: "Department of Rail Transport", url: "https://www.drt.go.th/" },
];

const relatedOrgs = [
  { th: "สำนักงานการบินพลเรือนแห่งประเทศไทย (กพท.)", en: "The Civil Aviation Authority of Thailand", url: "https://www.caat.or.th/" },
];

const stateEnterprises = [
  { th: "การรถไฟแห่งประเทศไทย (รฟท.)", en: "State Railway of Thailand", url: "https://www.railway.co.th/" },
  { th: "บริษัท รถไฟฟ้า ร.ฟ.ท. จำกัด (รฟฟท.)", en: "S.R.T. Electrified Train Company Limited", url: "https://www.srtet.co.th/th" },
  { th: "การท่าเรือแห่งประเทศไทย (กทท.)", en: "Port Authority of Thailand", url: "https://www.port.co.th/" },
  { th: "การรถไฟฟ้าขนส่งมวลชนแห่งประเทศไทย (รฟม.)", en: "Mass Rapid Transit Authority of Thailand", url: "http://www.mrta.co.th/" },
  { th: "การทางพิเศษแห่งประเทศไทย (กทพ.)", en: "Expressway Authority of Thailand", url: "https://www.exat.co.th/" },
  { th: "องค์การขนส่งมวลชนกรุงเทพ (ขสมก.)", en: "Bangkok Mass Transit Authority", url: "http://www.bmta.co.th/" },
  { th: "สถาบันการบินพลเรือน (สบพ.)", en: "Civil Aviation Training Center", url: "https://www.catc.or.th/" },
  { th: "บริษัท ขนส่ง จำกัด (บขส.)", en: "The Transport Company Limited", url: "http://www.transport.co.th/" },
  { th: "บริษัท ท่าอากาศยานไทย จำกัด (มหาชน) (ทอท.)", en: "Airports of Thailand Public Company Limited", url: "https://www.airportthai.co.th/" },
  { th: "บริษัท วิทยุการบินแห่งประเทศไทย จำกัด (บวท.)", en: "Aeronautical Radio of Thailand Limited", url: "https://www.aerothai.co.th/" },
  { th: "บริษัท โรงแรมท่าอากาศยานสุวรรณภูมิ จำกัด (รทส.)", en: "Suvarnabhumi Airport Hotel Company Limited", url: "http://www.suvarnabhumihotel.co.th/" },
  { th: "บริษัท เอสอาร์ที แอสเสท จำกัด (อทส.)", en: "SRT Asset Company Limited", url: "https://srtasset.com/" },
];

function formatDate(value: string, language: WpLanguage): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-US", { dateStyle: "medium" }).format(date);
}

export function SiteFooter({
  language,
  generatedAt,
}: {
  language: WpLanguage;
  generatedAt?: string;
}) {
  const th = language === "th";
  const generatedDate = generatedAt ? formatDate(generatedAt, language) : null;

  return (
    <footer className="site-footer">
      <div className="site-container footer-grid">
        <section>
          <Image
            src="/wp-content/uploads/2023/02/Logo_RTRDA.png"
            alt="RTRDA"
            width={80}
            height={80}
            style={{ height: "auto" }}
          />
          <p className="footer-org-name">
            {th
              ? "สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน)"
              : "Rail Technology Research and Development Agency (Public Organization)"}
          </p>
          <p className="footer-address">
            {th
              ? "อาคารศูนย์บริหารทางพิเศษ การทางพิเศษแห่งประเทศไทย (กทพ.) เลขที่ 111 ชั้น 10 ถนนริมคลองบางกะปิ แขวงบางกะปิ เขตห้วยขวาง กรุงเทพฯ 10310"
              : "EXAT Expressway Administration Center, 111 10th Floor, Rim Khlong Bang Kapi Rd., Bang Kapi, Huai Khwang, Bangkok 10310"}
          </p>
          <div className="footer-contact">
            <a href="mailto:info@rtrda.or.th">Email: info@rtrda.or.th</a>
            <span>
              TEL: <a href="tel:0822042998">082 204 2998</a>{" "}
              {th ? "หรือ" : "or"}{" "}
              <a href="tel:022482988">02 248 2988</a>
            </span>
          </div>
          {generatedDate ? (
            <p className="freshness">
              {th ? "ข้อมูลนำเข้าล่าสุด" : "Imported"}: {generatedDate}
            </p>
          ) : null}
          <div className="footer-visitor">
            <p className="footer-visitor-title">
              {th ? "จำนวนผู้เข้าชมเว็บไซต์" : "Website Visitors"}
            </p>
            <div className="footer-visitor-row">
              <span>{th ? "วันนี้" : "Today"}</span>
              <span className="footer-visitor-num">—</span>
            </div>
            <div className="footer-visitor-row">
              <span>{th ? "เมื่อวาน" : "Yesterday"}</span>
              <span className="footer-visitor-num">—</span>
            </div>
            <div className="footer-visitor-total">
              <span>{th ? "ทั้งหมด" : "Total"}</span>
              <span>
                <span className="footer-visitor-total-num">—</span>
                <span className="footer-visitor-sublabel">Total Visitors</span>
              </span>
            </div>
          </div>
        </section>

        <section>
          <h2>
            {th
              ? "ส่วนราชการในสังกัดกระทรวงคมนาคม"
              : "Government Agencies under Ministry of Transport"}
          </h2>
          <ul>
            {govAgencies.map((item) => (
              <li key={item.url}>
                <a href={item.url} target="_blank" rel="noreferrer">
                  {th ? item.th : item.en}
                </a>
              </li>
            ))}
          </ul>
          <h3>{th ? "หน่วยงานที่เกี่ยวข้อง" : "Related Organization"}</h3>
          <ul>
            {relatedOrgs.map((item) => (
              <li key={item.url}>
                <a href={item.url} target="_blank" rel="noreferrer">
                  {th ? item.th : item.en}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>
            {th
              ? "รัฐวิสาหกิจในสังกัดกระทรวงคมนาคม"
              : "State Enterprises under Ministry of Transport"}
          </h2>
          <ul>
            {stateEnterprises.map((item) => (
              <li key={item.url}>
                <a href={item.url} target="_blank" rel="noreferrer">
                  {th ? item.th : item.en}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>{th ? "เกี่ยวกับเว็บไซต์" : "About"}</h2>
          <ul>
            <li>
              <a href="#">{th ? "ข้อกำหนดการใช้งาน" : "Terms and Conditions"}</a>
            </li>
            <li>
              <a href={PRIVACY_POLICY_PDF} target="_blank" rel="noreferrer">
                {th ? "นโยบายการคุ้มครองข้อมูลส่วนบุคคล" : "Personal Data Protection Policy"}
              </a>
            </li>
            <li>
              <Link href="/แผนที่เว็บไซต์">{th ? "แผนที่เว็บไซต์" : "Sitemap"}</Link>
            </li>
            <li>
              <Link href="/การประเมินคุณธรรมและความโปร่งใส">
                {th
                  ? "การประเมินคุณธรรมและความโปร่งใส (ITA)"
                  : "Integrity and Transparency Assessment: ITA"}
              </Link>
            </li>
            <li>
              <Link href="/e-services">e-Services</Link>
            </li>
          </ul>
        </section>
      </div>

      <div className="footer-bar">
        <div className="site-container">
          {th
            ? "Copyright © สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) (สทร.) สงวนลิขสิทธิ์"
            : "Copyright © Rail Technology Research and Development Agency (Public Organization) All Rights Reserved."}
        </div>
      </div>
    </footer>
  );
}
