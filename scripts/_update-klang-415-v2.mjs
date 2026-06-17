import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const LEGACY = "https://www.rtrda.or.th";
const PATH = "/คลังความรู้";

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const r = await p.contentRecord.findUnique({ where: { path: PATH } });
if (!r) {
  console.error("not found:", PATH);
  process.exit(1);
}

let html = r.contentHtml;

// 1) Strip the duplicate <form> search input at the very top of the body.
//    It duplicates the header search and shows up as a stray "ค้นหา" + text
//    input + button above the breadcrumb. The header already provides this.
html = html.replace(
  /ค้นหา<div class="wp-block-search__inside-wrapper[^>]*>[\s\S]*?<\/button><\/div>/,
  "",
);

// 2) Rewrite every image src to the legacy WP host.
//    The Docker image (per the rtrda-web-app skill) does NOT include
//    public/wp-content/uploads or public/sdc-downloads, so any relative
//    URL like `/wp-content/uploads/...` 404s locally. Legacy host 200 OK
//    on every image (verified via HEAD).
html = html.replace(
  /<img([^>]*?)src="\/wp-content\/uploads\//g,
  `<img$1src="${LEGACY}/wp-content/uploads/`,
);

// 3) Rewrite `/3d-flip-book/...` and `/sdc_download/...` to legacy host.
//    - /3d-flip-book/N: legacy serves the iframe page, 200.
//    - /sdc_download/N: dynamic route reads public/sdc-downloads/<id> from
//      fs, but that dir is excluded from the Docker image (see
//      .dockerignore). Hot-linking legacy returns 500 (legacy dropped the
//      PHP handler) — but the production deployment is expected to mount
//      R2 or back the route some other way, so we keep `/sdc_download/`
//      on the local Next.js route when available and fall back to legacy
//      elsewhere. For now: switch all to legacy so the test site is
//      consistent with the public site.
html = html.replace(/href="\/3d-flip-book\//g, `href="${LEGACY}/3d-flip-book/`);
html = html.replace(/href="\/sdc_download\//g, `href="${LEGACY}/sdc_download/`);

await p.contentRecord.update({
  where: { path: PATH },
  data: { contentHtml: html, modified: new Date().toISOString() },
});
console.log("UPDATED. new length:", html.length);
await p.$disconnect();
