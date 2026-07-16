import sanitizeHtml from "sanitize-html";

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

const allowedAttributes: sanitizeHtml.IOptions["allowedAttributes"] = {
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
    "sandbox",
    "src",
    "title",
    "width",
  ],
};

const safeStyleValue = /^(?!.*(?:url\s*\(|expression\s*\(|@import|javascript:)).*$/i;
const allowedStyleProperties = [
  "aspect-ratio",
  "background",
  "background-color",
  "border",
  "border-color",
  "border-style",
  "border-width",
  "color",
  "flex-basis",
  "font-family",
  "font-size",
  "grid-template-columns",
  "height",
  "line-height",
  "max-height",
  "max-width",
  "object-fit",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "text-align",
  "width",
];

const allowedStyles = {
  "*": Object.fromEntries(
    allowedStyleProperties.map((property) => [property, [safeStyleValue]]),
  ),
};

export function sanitizeContentHtml(html: string): string {
  return sanitizeHtml(html ?? "", {
    allowedTags,
    allowedAttributes,
    allowedStyles,
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    allowedIframeHostnames: ["www.youtube.com", "www.google.com"],
    allowIframeRelativeUrls: true,
    transformTags: {
      a: (_tagName, attribs) => {
        if (attribs.target !== "_blank") return { tagName: "a", attribs };
        const rel = new Set((attribs.rel ?? "").split(/\s+/).filter(Boolean));
        rel.add("noopener");
        rel.add("noreferrer");
        return { tagName: "a", attribs: { ...attribs, rel: [...rel].join(" ") } };
      },
    },
  });
}
