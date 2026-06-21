import Link from "next/link";
import { LanguageToggle } from "./language-toggle";
import { ReaderControls } from "./reader-controls";
import type { WpLanguage } from "@/lib/wp/types";

export function FooterUtility({
  alternatePath,
  language,
}: {
  alternatePath: string;
  language: WpLanguage;
}) {
  const isEn = language === "en";

  return (
    <div className="footer-utility">
      <ReaderControls language={language} />
      <div className="footer-utility-links">
        <Link href={isEn ? "/en/แผนที่เว็บไซต์" : "/แผนที่เว็บไซต์"}>
          {isEn ? "Sitemap" : "แผนที่เว็บไซต์"}
        </Link>
        <LanguageToggle alternatePath={alternatePath} language={language} />
      </div>
    </div>
  );
}
