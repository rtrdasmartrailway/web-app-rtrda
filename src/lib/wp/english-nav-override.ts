import type { PresentationNavItem } from "./presentation";
import type { WpLanguage } from "./types";

const labelsByPath = new Map<string, string>([
  ["/en/วัตถุประสงค์การจัดตั้ง", "Establishment Objectives and Statutory Powers"],
  ["/en/category/ประกาศ", "Announcements"],
  ["/en/การประเมินคุณธรรมและคว", "Integrity and Transparency Assessment (ITA)"],
  ["/en/ประชาพิจารณ์", "Public Hearings"],
  ["/en/ช่องทางการแจ้งเรื่องกา", "Reporting Channels for Corruption and Misconduct"],
  ["/en/ช่องทางการแจ้งเรื่องร้", "Complaints and Whistleblowing"],
]);

const labelsByHref = new Map<string, string>([
  [
    "https://infocenter.oic.go.th/rtrda/index.php",
    "Official Information Act, B.E. 2540 (1997)",
  ],
]);

/** Replace legacy Thai labels that are shared by every English navigation menu. */
export function applyEnglishNavOverride(
  items: PresentationNavItem[],
  language: WpLanguage,
): PresentationNavItem[] {
  if (language !== "en") return items;

  return items.map((item) => ({
    ...item,
    label:
      (item.path ? labelsByPath.get(item.path) : undefined) ??
      labelsByHref.get(item.href) ??
      item.label,
    children: applyEnglishNavOverride(item.children, language),
  }));
}
