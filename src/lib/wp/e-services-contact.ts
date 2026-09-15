import * as cheerio from "cheerio";
import { RTRDA_CONTACT_MAP_EMBED_URL } from "./contact-map";
import type { WpContentRecord } from "./types";
import { normalizeRoutePath } from "./url";

const E_SERVICES_PATH = "/e-services";

function isEServicesPath(path: string): boolean {
  return normalizeRoutePath(path).replace(/^\/en(?=\/)/, "") === E_SERVICES_PATH;
}

function buildContactTableHtml(language: WpContentRecord["language"]): string {
  const isThai = language === "th";
  const labels = isThai
    ? {
        address: "ที่อยู่",
        officialEmail: "อีเมลรับ-ส่งหนังสือราชการ",
        inquiryEmail: "อีเมลสอบถามข้อมูลและร้องเรียน",
        phone: "โทรศัพท์",
        map: "แผนที่",
        mapTitle: "แผนที่ตั้ง สทร.",
        openMap: "เปิดใน Google Maps",
      }
    : {
        address: "Address",
        officialEmail: "Official correspondence email",
        inquiryEmail: "Information and complaint email",
        phone: "Telephone",
        map: "Map",
        mapTitle: "RTRDA location map",
        openMap: "Open in Google Maps",
      };
  const address = isThai
    ? "สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน)<br>อาคารศูนย์บริหารทางพิเศษ การทางพิเศษแห่งประเทศไทย (กทพ.)<br>เลขที่ 111 ชั้น 10 ถนนริมคลองบางกะปิ แขวงบางกะปิ เขตห้วยขวาง กรุงเทพฯ 10310"
    : "Rail Technology Research and Development Agency (Public Organization)<br>EXAT Expressway Administration Center<br>111 10th Floor, Rim Khlong Bang Kapi Rd., Bang Kapi, Huai Khwang, Bangkok 10310";

  return (
    `<div class="e-services-contact-table-wrap"><table class="e-services-contact-table"><tbody>` +
    `<tr><th scope="row">${labels.address}</th><td>${address}</td></tr>` +
    `<tr><th scope="row">${labels.officialEmail}</th><td><a href="mailto:saraban@rtrda.or.th">saraban@rtrda.or.th</a></td></tr>` +
    `<tr><th scope="row">${labels.inquiryEmail}</th><td><a href="mailto:info@rtrda.or.th">info@rtrda.or.th</a></td></tr>` +
    `<tr><th scope="row">${labels.phone}</th><td><a href="tel:0822042998">082 204 2998</a> ${isThai ? "หรือ" : "or"} <a href="tel:022482988">02 248 2988</a></td></tr>` +
    `<tr><th scope="row">${labels.map}</th><td><iframe src="${RTRDA_CONTACT_MAP_EMBED_URL}" title="${labels.mapTitle}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe><a class="e-services-contact-map-link" href="https://www.google.com/maps/place/%E0%B8%AA%E0%B8%96%E0%B8%B2%E0%B8%9A%E0%B8%B1%E0%B8%99%E0%B8%A7%E0%B8%B4%E0%B8%88%E0%B8%B1%E0%B8%A2%E0%B9%81%E0%B8%A5%E0%B8%B0%E0%B8%9E%E0%B8%B1%E0%B8%92%E0%B8%99%E0%B8%B2%E0%B9%80%E0%B8%97%E0%B8%84%E0%B9%82%E0%B8%99%E0%B9%82%E0%B8%A5%E0%B8%A2%E0%B8%B5%E0%B8%A3%E0%B8%B0%E0%B8%9A%E0%B8%9A%E0%B8%A3%E0%B8%B2%E0%B8%87+(%E0%B8%AD%E0%B8%87%E0%B8%84%E0%B9%8C%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%A1%E0%B8%AB%E0%B8%B2%E0%B8%8A%E0%B8%99)/@13.7506737,100.5682118,20z/data=!4m6!3m5!1s0x30e29f004355d1b7:0xd97ebac98e579c96!8m2!3d13.7505783!4d100.5681343!16s%2Fg%2F11xn3t723_?hl=th" target="_blank" rel="noreferrer noopener">${labels.openMap}</a></td></tr>` +
    `</tbody></table></div>`
  );
}

export function applyEServicesContactOverride(record: WpContentRecord): WpContentRecord {
  if (!isEServicesPath(record.path)) return record;

  const $ = cheerio.load(record.contentHtml, null, false);
  const contactAccordion = $(".lightweight-accordion")
    .filter((_index, element) => {
      const label = $(element).find("summary").first().text().trim();
      return label.includes("ข้อมูลการติดต่อ") || label.includes("Contact Information");
    })
    .first();

  if (
    contactAccordion.length === 0 ||
    contactAccordion.find(".e-services-contact-table-wrap").length > 0
  ) {
    return record;
  }

  const body = contactAccordion.find(".lightweight-accordion-body").first();
  if (body.length === 0) return record;

  body.append(buildContactTableHtml(record.language));
  return { ...record, contentHtml: $.html() };
}
