import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';

const PATH = '/คลังความรู้';
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const r = await p.contentRecord.findUnique({ where: { path: PATH } });
if (!r) { console.error('not found'); process.exit(1); }

let html = r.contentHtml;

// Force eager loading for cover images — they are above the fold
// inside the open accordion and lazy-load blocks first-paint on slow links.
html = html.replace(/<img([^>]*?)loading="lazy"/g, '<img$1loading="eager"');

await p.contentRecord.update({
  where: { path: PATH },
  data: { contentHtml: html, modified: new Date().toISOString() },
});
console.log('UPDATED. length:', html.length);
await p.$disconnect();
