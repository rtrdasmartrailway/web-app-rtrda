import * as cheerio from "cheerio";
import type { WpContentRecord } from "./types";
import { normalizeRoutePath } from "./url";

const CONTACT_INFORMATION_PATH = "/ติดต่อเรา/ช่องทางการติดต่อ";

const RTRDA_PLACE_QUERY = "สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน)";
const RTRDA_PLACE_URL =
  "https://www.google.com/maps/place/" +
  "%E0%B8%AA%E0%B8%96%E0%B8%B2%E0%B8%9A%E0%B8%B1%E0%B8%99%E0%B8%A7%E0%B8%B4%E0%B8%88%E0%B8%B1%E0%B8%A2" +
  "%E0%B9%81%E0%B8%A5%E0%B8%B0%E0%B8%9E%E0%B8%B1%E0%B8%92%E0%B8%99%E0%B8%B2" +
  "%E0%B9%80%E0%B8%97%E0%B8%84%E0%B9%82%E0%B8%99%E0%B9%82%E0%B8%A5%E0%B8%A2%E0%B8%B5" +
  "%E0%B8%A3%E0%B8%B0%E0%B8%9A%E0%B8%9A%E0%B8%A3%E0%B8%B2%E0%B8%87+(%E0%B8%AD%E0%B8%87%E0%B8%84%E0%B9%8C" +
  "%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%A1%E0%B8%AB%E0%B8%B2%E0%B8%8A%E0%B8%99)/" +
  "@13.7506737,100.5682118,20z/data=!4m6!3m5!1s0x30e29f004355d1b7:0xd97ebac98e579c96" +
  "!8m2!3d13.7505783!4d100.5681343!16s%2Fg%2F11xn3t723_?hl=th";

export const RTRDA_CONTACT_MAP_EMBED_URL =
  `https://www.google.com/maps?q=${encodeURIComponent(RTRDA_PLACE_QUERY)}` +
  "&ll=13.7505783,100.5681343&z=18&output=embed";

const CONTACT_FORM_LINK_SELECTOR = 'a[href*="forms.gle/"]';
const CONTACT_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSd8nY4Dt-vjvl6Ag4Jnwq_Ko5zEUT7FgKH8DB-wql74KAVe5w/viewform";

function isContactInformationPath(path: string): boolean {
  return normalizeRoutePath(path).replace(/^\/en(?=\/)/, "") === CONTACT_INFORMATION_PATH;
}

export function applyContactMapOverride(record: WpContentRecord): WpContentRecord {
  if (!isContactInformationPath(record.path)) {
    return record;
  }

  const $ = cheerio.load(record.contentHtml, null, false);
  const mapIframes = $('iframe[src*="google.com/maps"]');
  const contactFormLink = $(CONTACT_FORM_LINK_SELECTOR).first();

  if (mapIframes.length > 0) {
    mapIframes.attr("src", RTRDA_CONTACT_MAP_EMBED_URL);
    mapIframes.attr(
      "title",
      record.language === "th" ? "แผนที่ตั้ง สทร." : "RTRDA location map",
    );

    if ($(".contact-map-place-card").length === 0) {
      const openMapLabel =
        record.language === "th" ? "เปิดใน Google Maps" : "Open in Google Maps";

      mapIframes
        .first()
        .before(
          `<div class="contact-map-place-card">` +
            `<strong>${RTRDA_PLACE_QUERY}</strong>` +
            `<a href="${RTRDA_PLACE_URL}" target="_blank" rel="noreferrer">${openMapLabel}</a>` +
            `</div>`,
        );
    }
  }

  if (contactFormLink.length > 0 && $(".contact-form-cta").length === 0) {
    const label = record.language === "th" ? "ช่องทางการติดต่อ" : "Contact Form";

    contactFormLink.closest(".elementor-widget-button").remove();
    $.root().prepend(
      `<div class="contact-form-cta">` +
        `<a href="${CONTACT_FORM_URL}" target="_blank" rel="noreferrer">${label}</a>` +
        `</div>`,
    );
  }

  if (mapIframes.length === 0 && contactFormLink.length === 0) {
    return record;
  }

  return {
    ...record,
    contentHtml: $.html(),
  };
}
