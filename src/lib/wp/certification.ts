import type { PresentationNavItem } from "./presentation";
import type { WpLanguage } from "./types";

export const CERTIFICATION_LABEL = "หน่วยรับรอง";
export const certificationPages = [
  { label: "นโยบาย", slug: "นโยบาย" },
  { label: "หลักเกณฑ์การรับรอง", slug: "หลักเกณฑ์การรับรอง" },
  { label: "กระบวนการอุทธรณ์ร้องเรียน", slug: "กระบวนการอุทธรณ์ร้องเรียน" },
  { label: "ทะเบียนรายชื่อผู้ได้รับการรับรอง", slug: "ทะเบียนรายชื่อผู้ได้รับการรับรอง" },
] as const;

export function applyCertificationNavOverride(
  items: PresentationNavItem[],
  language: WpLanguage,
  currentPath: string,
): PresentationNavItem[] {
  if (language !== "th" || items.some((item) => item.label === CERTIFICATION_LABEL))
    return items;
  const children: PresentationNavItem[] = certificationPages.map(({ label, slug }) => {
    const path = `/${CERTIFICATION_LABEL}/${slug}`;
    return {
      label,
      href: path,
      path,
      external: false,
      active: currentPath === path,
      children: [],
    };
  });
  const parent: PresentationNavItem = {
    label: CERTIFICATION_LABEL,
    href: "#",
    path: null,
    external: false,
    active: children.some((child) => child.active),
    children,
  };
  const contactIndex = items.findIndex((item) => item.label === "ติดต่อเรา");
  const index = contactIndex >= 0 ? contactIndex : items.length;
  return [...items.slice(0, index), parent, ...items.slice(index)];
}
