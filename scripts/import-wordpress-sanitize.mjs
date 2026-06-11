import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";
import { rewriteSrcSet, rewriteUrl } from "./import-wordpress-helpers.mjs";

const allowedTags = [
  ...sanitizeHtml.defaults.allowedTags,
  "article",
  "aside",
  "audio",
  "button",
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
  a: ["aria-*", "class", "href", "name", "rel", "target", "title"],
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

/**
 * Sanitize WordPress-rendered HTML and rewrite rtrda.or.th URLs to local
 * route paths (uploads, downloads, internal links).
 */
export function sanitizeAndRewrite(html) {
  return sanitizeHtml(html ?? "", {
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
