import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";
import { rewriteSrcSet, rewriteUrl } from "./import-wordpress-helpers.mjs";

const allowedTags = [
  ...sanitizeHtml.defaults.allowedTags,
  "article",
  "aside",
  "audio",
  "button",
  "col",
  "colgroup",
  "details",
  "div",
  "figure",
  "figcaption",
  "h1",
  "h2",
  "iframe",
  "img",
  "nav",
  "section",
  "source",
  "span",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "video",
];

const allowedAttributes = {
  ...sanitizeHtml.defaults.allowedAttributes,
  "*": [
    "aria-*",
    "class",
    "colspan",
    "data-*",
    "height",
    "id",
    "open",
    "rowspan",
    "style",
    "title",
    "width",
  ],
  a: ["aria-*", "class", "download", "href", "name", "rel", "target", "title"],
  col: ["span", "style", "width", "class"],
  colgroup: ["span", "style", "class"],
  img: [
    "alt",
    "class",
    "decoding",
    "height",
    "loading",
    "sizes",
    "src",
    "srcset",
    "title",
    "width",
  ],
  iframe: [
    "allow",
    "allowfullscreen",
    "class",
    "height",
    "loading",
    "referrerpolicy",
    "src",
    "title",
    "width",
  ],
};

// Non-content theme/plugin chrome embedded in WordPress-rendered HTML. These
// are the Lightning/VK ExUnit social share + follow boxes (sb_facebook,
// Hatena, Pocket, "Copy" …) and post meta — JS-driven widgets with no working
// links once migrated, so they render as stray plain text. Removed from
// content; the parity audit strips the same selectors from the old side.
const IMPORTED_CHROME_SELECTORS = [
  ".veu_socialSet",
  ".veu_followSet",
  ".veu_contentAddSection",
  ".followSet",
  ".followSet_body",
  ".vk_post",
];

/**
 * Drop non-content theme chrome (social share/follow boxes, post meta) from a
 * fragment of WordPress HTML. Safe to run on already-imported content.
 */
export function stripImportedChrome(html) {
  if (!html) {
    return html ?? "";
  }
  const $ = cheerio.load(html, null, false);
  $(IMPORTED_CHROME_SELECTORS.join(",")).remove();
  return $.html();
}

/**
 * Sanitize WordPress-rendered HTML and rewrite rtrda.or.th URLs to local
 * route paths (uploads, downloads, internal links).
 */
export function sanitizeAndRewrite(html) {
  return sanitizeHtml(stripImportedChrome(html ?? ""), {
    allowedTags,
    allowedAttributes,
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          href: attribs.href ? rewriteUrl(attribs.href) : undefined,
        },
      }),
      img: (_tagName, attribs) => ({
        tagName: "img",
        attribs: {
          ...attribs,
          src: attribs.src ? rewriteUrl(attribs.src) : undefined,
          srcset: attribs.srcset ? rewriteSrcSet(attribs.srcset) : undefined,
        },
      }),
      iframe: (_tagName, attribs) => ({
        tagName: "iframe",
        attribs: {
          ...attribs,
          src: attribs.src ? rewriteUrl(attribs.src) : undefined,
        },
      }),
    },
  });
}

export function htmlToText(value) {
  return cheerio
    .load(`<body>${value ?? ""}</body>`)("body")
    .text()
    .trim();
}

export function stripHtml(value) {
  return cheerio
    .load(`<body>${value ?? ""}</body>`)("body")
    .text()
    .trim();
}
