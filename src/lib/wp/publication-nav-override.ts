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

export function applyPublicationNavOverride(
  items: PresentationNavItem[],
  language: WpLanguage,
  currentPath: string,
): PresentationNavItem[] {
  if (language !== "th") return items;

  return items.map((item) => {
    if (item.label !== publicationsLabel[language]) return item;

    const additions = [
      { label: moralityReportTitle, path: moralityReportPath },
      { label: railStrategyPublicationTitle, path: railStrategyPublicationPath },
    ].filter((addition) => !item.children.some((child) => child.path === addition.path));
    const children = [
      ...item.children,
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
