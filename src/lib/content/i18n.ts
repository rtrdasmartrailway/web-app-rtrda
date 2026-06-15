import type { WpLanguage } from "@/lib/wp/types";
import { normalizeRoutePath } from "@/lib/wp/url";

/**
 * Bilingual content is stored one row per item with `_th`/`_en` columns and a
 * single canonical (Thai) `path`/`slug`. The `/en` URL prefix selects the
 * English fields at read time. These helpers convert between the request URL
 * (language-specific) and the canonical key, and pick the right language field.
 */

/** Split a request path into its language and canonical (Thai) path. */
export function splitLanguage(rawPath: string): { language: WpLanguage; canonical: string } {
  const p = normalizeRoutePath(rawPath);
  if (p === "/en" || p.startsWith("/en/")) {
    return { language: "en", canonical: p.replace(/^\/en/, "") || "/" };
  }
  return { language: "th", canonical: p };
}

/** Build the language-specific display path from a canonical (Thai) path. */
export function displayPath(canonical: string, language: WpLanguage): string {
  if (language === "th") return canonical;
  return canonical === "/" ? "/en" : `/en${canonical}`;
}

/** Pick the field for `language`, falling back to the other language when empty. */
export function pickLang(th: string, en: string, language: WpLanguage): string {
  return language === "en" ? en || th : th || en;
}
