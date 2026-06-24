import * as cheerio from "cheerio";
import type { WpContentRecord } from "./types";
import { normalizeRoutePath } from "./url";

const CONTACT_INFORMATION_PATH = "/ติดต่อเรา/ช่องทางการติดต่อ";

export const RTRDA_CONTACT_MAP_EMBED_URL =
  "https://www.google.com/maps?q=13.7505783,100.5681343&z=18&output=embed";

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
