import type { WpLanguage } from "./types";
import type { PresentationNavItem } from "./presentation";
import { moralityReportPath, moralityReportTitle } from "./morality-report-documents";

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

    const exists = item.children.some((child) => child.path === moralityReportPath);
    const children = exists
      ? item.children
      : [
          ...item.children,
          {
            label: moralityReportTitle,
            href: moralityReportPath,
            path: moralityReportPath,
            external: false,
            active: currentPath === moralityReportPath,
            children: [],
          },
        ];

    return {
      ...item,
      active: item.active || currentPath === moralityReportPath,
      children,
    };
  });
}
