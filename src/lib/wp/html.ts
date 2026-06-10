import sanitizeHtml from "sanitize-html";
import { getRtrdaPathFromUrl, rewriteRtrdaUrl } from "./url";

const UPLOAD_RE =
  /https?:\/\/www\.rtrda\.or\.th\/wp-content\/uploads\/[^\s"'<>)]*/gi;

const ALLOWED_TAGS = [
  ...sanitizeHtml.defaults.allowedTags,
  "article",
  "aside",
  "audio",
  "button",
  "details",
  "div",
  "figure",
  "figcaption",
  "form",
  "h1",
  "h2",
  "iframe",
  "img",
  "input",
  "label",
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

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
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
  button: ["aria-*", "class", "name", "type", "value"],
  form: ["action", "aria-*", "class", "method", "role"],
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
  input: ["aria-*", "class", "id", "name", "placeholder", "type", "value"],
  label: ["class", "for", "id"],
};

function rewriteAttributeValue(value: string): string {
  return rewriteRtrdaUrl(value);
}

function rewriteSrcSet(value: string): string {
  return value
    .split(",")
    .map((part) => {
      const [url, ...descriptor] = part.trim().split(/\s+/);
      return [rewriteAttributeValue(url), ...descriptor].filter(Boolean).join(" ");
    })
    .join(", ");
}

function withRewrittenAttribute(
  attribs: sanitizeHtml.Attributes,
  key: string,
  rewriter: (value: string) => string,
): sanitizeHtml.Attributes {
  const next = { ...attribs };
  if (next[key]) {
    next[key] = rewriter(next[key]);
  } else {
    delete next[key];
  }
  return next;
}

export function sanitizeAndRewriteHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: withRewrittenAttribute(attribs, "href", rewriteAttributeValue),
      }),
      img: (_tagName, attribs) => ({
        tagName: "img",
        attribs: withRewrittenAttribute(
          withRewrittenAttribute(attribs, "src", rewriteAttributeValue),
          "srcset",
          rewriteSrcSet,
        ),
      }),
      iframe: (_tagName, attribs) => ({
        tagName: "iframe",
        attribs: withRewrittenAttribute(attribs, "src", rewriteAttributeValue),
      }),
      form: (_tagName, attribs) => {
        const next = withRewrittenAttribute(attribs, "action", rewriteAttributeValue);
        const isSearchForm =
          next.role === "search" || next.class?.split(/\s+/).includes("wp-block-search");

        if (isSearchForm) {
          next.action = "/search";
          next.method = "get";
        }

        return {
          tagName: "form",
          attribs: next,
        };
      },
      input: (_tagName, attribs) => {
        const next = { ...attribs };
        if (next.name === "s" && next.type === "search") {
          next.name = "q";
        }

        return {
          tagName: "input",
          attribs: next,
        };
      },
    },
  });
}

export function extractUploadUrls(html: string): string[] {
  return Array.from(new Set(html.match(UPLOAD_RE) ?? []));
}

export function extractInternalLinks(html: string): string[] {
  const hrefs = Array.from(html.matchAll(/\s(?:href|src)=["']([^"']+)["']/gi))
    .map((match) => getRtrdaPathFromUrl(match[1]))
    .filter((path): path is string => Boolean(path))
    .filter((path) => !path.startsWith("/wp-content/uploads/"));

  return Array.from(new Set(hrefs));
}
