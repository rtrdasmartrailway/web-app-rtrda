import type { WpLanguage } from "./types";
import type { PresentationNavItem } from "./presentation";
import { moralityReportPath, moralityReportTitle } from "./morality-report-documents";
import {
  railStrategyPublicationPath,
  railStrategyPublicationTitle,
} from "./rail-strategy-publication";

const publicationsLabel: Record<WpLanguage, string> = {
  th: "เอกสารเผยแพร่",
  en: "Publications",
};
const temporarilyHiddenThaiLabels = new Set(["เผยแพร่ข้อมูลตามหลักธรรมาภิบาล"]);

export function applyPublicationNavOverride(
  items: PresentationNavItem[],
  language: WpLanguage,
  currentPath: string,
): PresentationNavItem[] {
  if (language !== "th") return items;

  return items.map((item) => {
    if (item.label !== publicationsLabel[language]) return item;

    const visibleChildren = item.children.filter(
      (child) => !temporarilyHiddenThaiLabels.has(child.label),
    );
    const additions = [
      { label: moralityReportTitle, path: moralityReportPath },
      { label: railStrategyPublicationTitle, path: railStrategyPublicationPath },
    ].filter(
      (addition) => !visibleChildren.some((child) => child.path === addition.path),
    );
    const children = [
      ...visibleChildren,
      ...additions.map((addition) => ({
        ...addition,
        href: addition.path,
        external: false,
        active: currentPath === addition.path,
        children: [],
      })),
    ];

    return {
      ...item,
      active: item.active || children.some((child) => child.active),
      children,
    };
  });
}
