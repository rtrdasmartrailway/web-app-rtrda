import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const r = await p.contentRecord.findUnique({
  where: { path: '/คลังความรู้' },
  select: { contentHtml: true },
});
const imgs = [...new Set([...r.contentHtml.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m => m[1]))];
console.log('UNIQUE IMG SRCS:', imgs.length);
// Check legacy for each
for (const src of imgs) {
  const url = 'https://www.rtrda.or.th' + (src.startsWith('/') ? src : '/' + src);
  const code = await fetch(url, { method: 'HEAD' }).then(r => r.status).catch(() => 'err');
  console.log(`${code}  ${src}`);
}
await p.$disconnect();
