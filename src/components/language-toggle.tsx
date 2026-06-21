import Link from "next/link";
import type { WpLanguage } from "@/lib/wp/types";

export function LanguageToggle({
  alternatePath,
  className,
  language,
}: {
  alternatePath: string;
  className?: string;
  language: WpLanguage;
}) {
  const classNames = ["language-toggle", className].filter(Boolean).join(" ");
  const ariaLabel = language === "th" ? "เปลี่ยนภาษา" : "Change language";

  return (
    <div className={classNames} role="group" aria-label={ariaLabel}>
      {language === "th" ? (
        <span className="language-toggle-item active" aria-current="true">
          TH
        </span>
      ) : (
        <Link className="language-toggle-item" href={alternatePath}>
          TH
        </Link>
      )}
      {language === "en" ? (
        <span className="language-toggle-item active" aria-current="true">
          EN
        </span>
      ) : (
        <Link className="language-toggle-item" href={alternatePath}>
          EN
        </Link>
      )}
    </div>
  );
}
