import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const r = await p.contentRecord.findUnique({ where: { path: "/คลังความรู้" } });
// Count various URL patterns
const html = r.contentHtml;
const stats = {
  total: html.length,
  legacy_img: (html.match(/src="https:\/\/www\.rtrda\.or\.th\/wp-content/g) || []).length,
  legacy_3d: (html.match(/href="https:\/\/www\.rtrda\.or\.th\/3d-flip-book/g) || [])
    .length,
  legacy_sdc: (html.match(/href="https:\/\/www\.rtrda\.or\.th\/sdc_download/g) || [])
    .length,
  rel_img: (html.match(/src="\/wp-content/g) || []).length,
  rel_3d: (html.match(/href="\/3d-flip-book/g) || []).length,
  rel_sdc: (html.match(/href="\/sdc_download/g) || []).length,
  search_form_present: html.includes("wp-block-search__inside-wrapper"),
  lazy_remaining: (html.match(/loading="lazy"/g) || []).length,
  eager_total: (html.match(/loading="eager"/g) || []).length,
};
console.log(JSON.stringify(stats, null, 2));
await p.$disconnect();
