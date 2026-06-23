import type { PresentationNavItem } from "./presentation";
import type { WpLanguage } from "./types";

export const NACC_COMPLAINT_URL =
  "https://www.nacc.go.th/allcomplaint?csrt=930900954617268973";
export const PACC_COMPLAINT_URL = "https://www.pacc.go.th/e-service/index.html";

const NACC_LABEL = "ช่องทางแจ้งเรื่องร้องเรียนฯ สำนักงาน ป.ป.ช.";
const PACC_LABEL = "ช่องทางแจ้งเรื่องร้องเรียนฯ สำนักงาน ป.ป.ท";
const CONTACT_LABEL = "ติดต่อเรา";

function hasChild(navItem: PresentationNavItem, label: string): boolean {
  return navItem.children.some((child) => child.label === label);
}

function buildExternalChild(label: string, href: string): PresentationNavItem {
  return {
    label,
    href,
    path: null,
    external: true,
    active: false,
    children: [],
  };
}

export function applyContactNavOverride(
  navItems: PresentationNavItem[],
  language: WpLanguage,
): PresentationNavItem[] {
  if (language !== "th" || navItems.length === 0) {
    return navItems;
  }

  let didChange = false;
  const nextItems = navItems.map((item) => {
    if (item.label !== CONTACT_LABEL) {
      return item;
    }

    const appendNacc = !hasChild(item, NACC_LABEL);
    const appendPacc = !hasChild(item, PACC_LABEL);
    if (!appendNacc && !appendPacc) {
      return item;
    }

    const children = [...item.children];
    if (appendNacc) {
      children.push(buildExternalChild(NACC_LABEL, NACC_COMPLAINT_URL));
    }
    if (appendPacc) {
      children.push(buildExternalChild(PACC_LABEL, PACC_COMPLAINT_URL));
    }
    didChange = true;
    return { ...item, children };
  });

  return didChange ? nextItems : navItems;
}
