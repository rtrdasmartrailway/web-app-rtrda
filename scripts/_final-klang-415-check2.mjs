import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const r = await p.contentRecord.findUnique({ where: { path: "/คลังความรู้" } });
const html = r.contentHtml;
// count leftover relative URLs
const stats = {
  total: html.length,
  rel_src: (html.match(/src="\/wp-content/g) || []).length,
  rel_href_wpcontent: (html.match(/href="\/wp-content/g) || []).length,
  rel_href_3d: (html.match(/href="\/3d-flip-book/g) || []).length,
  rel_href_sdc: (html.match(/href="\/sdc_download/g) || []).length,
  rel_srcset: (html.match(/srcset="[^"]*\/wp-content/g) || []).length,
  legacy_img: (html.match(/src="https:\/\/www\.rtrda\.or\.th\/wp-content/g) || []).length,
  legacy_srcset: (
    html.match(/srcset="[^"]*https:\/\/www\.rtrda\.or\.th\/wp-content/g) || []
  ).length,
};
console.log(JSON.stringify(stats, null, 2));
await p.$disconnect();
