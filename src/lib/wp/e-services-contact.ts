import * as cheerio from "cheerio";
import { NACC_COMPLAINT_URL, PACC_COMPLAINT_URL } from "./contact-nav-override";
import type { WpContentRecord } from "./types";
import { normalizeRoutePath } from "./url";

const E_SERVICES_PATH = "/e-services";

function isEServicesPath(path: string): boolean {
  return normalizeRoutePath(path).replace(/^\/en(?=\/)/, "") === E_SERVICES_PATH;
}

function buildContactTableHtml(language: WpContentRecord["language"]): string {
  const isThai = language === "th";
  const links = isThai
    ? {
        number: "ลำดับ",
        channel: "ช่องทางแจ้งเรื่องร้องเรียน",
        items: [
          {
            label: "ช่องทางการแจ้งเรื่องการทุจริตและประพฤติมิชอบ",
            href: "/ช่องทางการแจ้งเรื่องกา",
          },
          {
            label: "การรับเรื่องร้องเรียน / แจ้งเบาะแส",
            href: "/ช่องทางการแจ้งเรื่องร้",
          },
          {
            label: "ช่องทางแจ้งเรื่องร้องเรียนฯ สำนักงาน ป.ป.ช.",
            href: NACC_COMPLAINT_URL,
          },
          {
            label: "ช่องทางแจ้งเรื่องร้องเรียนฯ สำนักงาน ป.ป.ท",
            href: PACC_COMPLAINT_URL,
          },
        ],
      }
    : {
        number: "No.",
        channel: "Complaint reporting channels",
        items: [
          {
            label: "Reporting Channels for Corruption and Misconduct",
            href: "/en/ช่องทางการแจ้งเรื่องกา",
          },
          { label: "Complaints and Whistleblowing", href: "/en/ช่องทางการแจ้งเรื่องร้" },
          {
            label: "ช่องทางแจ้งเรื่องร้องเรียนฯ สำนักงาน ป.ป.ช.",
            href: NACC_COMPLAINT_URL,
          },
          {
            label: "ช่องทางแจ้งเรื่องร้องเรียนฯ สำนักงาน ป.ป.ท",
            href: PACC_COMPLAINT_URL,
          },
        ],
      };
  const rows = links.items
    .map((item, index) => {
      const external = item.href.startsWith("http");
      const target = external ? ' target="_blank" rel="noreferrer noopener"' : "";
      return `<tr><th scope="row">${index + 1}</th><td><a href="${item.href}"${target}>${item.label}</a></td></tr>`;
    })
    .join("");

  return (
    `<div class="e-services-contact-table-wrap"><table class="e-services-contact-table"><thead><tr>` +
    `<th scope="col">${links.number}</th><th scope="col">${links.channel}</th>` +
    `</tr></thead><tbody>${rows}</tbody></table></div>`
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
