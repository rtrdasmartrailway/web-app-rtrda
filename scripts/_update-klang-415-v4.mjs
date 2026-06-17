import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const LEGACY = "https://www.rtrda.or.th";
const PATH = "/คลังความรู้";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const r = await p.contentRecord.findUnique({ where: { path: PATH } });
if (!r) {
  console.error("not found");
  process.exit(1);
}

let html = r.contentHtml;
let changed = 0;

// 1) Rewrite srcset attribute — every token that starts with /wp-content/... must be prefixed with the legacy host.
//    The attribute is a comma-separated list of "url sizew" pairs. We'll
//    only touch the URL portion, leaving the descriptor (e.g. "602w") alone.
function rewriteSrcset(s) {
  return s.replace(
    /(\s|^)(\/wp-content\/uploads\/[^\s,]+)/g,
    (_, sp, url) => `${sp}${LEGACY}${url}`,
  );
}

html = html.replace(/srcset="([^"]+)"/g, (m, val) => {
  const next = rewriteSrcset(val);
  if (next !== val) changed++;
  return `srcset="${next}"`;
});

// 2) Rewrite sizes attribute (also contains relative URLs sometimes — wp uses
//    `sizes="auto, (max-width: 602px) 100vw, 602px"`, not a URL, so no change).

// 3) Belt-and-suspenders: catch any leftover bare /wp-content/ or /sdc_download/
//    href/src that we may have missed (skip the alt= etc).
html = html.replace(/(src|href)="\/wp-content\/uploads\//g, (m) =>
  `${m.replace('/"', '"')}${LEGACY.replace(/^https?:\/\//, "")}/wp-content/`
    .replace('"https', '"https://')
    .replace('/"', "/"),
);
// Simpler: do them in two passes.
html = html.replace(
  /src="\/wp-content\/uploads\//g,
  `src="${LEGACY}/wp-content/uploads/`,
);
html = html.replace(
  /href="\/wp-content\/uploads\//g,
  `href="${LEGACY}/wp-content/uploads/`,
);
html = html.replace(/href="\/3d-flip-book\//g, `href="${LEGACY}/3d-flip-book/`);
html = html.replace(/href="\/sdc_download\//g, `href="${LEGACY}/sdc_download/`);

console.log("Rewrote", changed, "srcset attributes");

await p.contentRecord.update({
  where: { path: PATH },
  data: { contentHtml: html, modified: new Date().toISOString() },
});
console.log("UPDATED. length:", html.length);
await p.$disconnect();
