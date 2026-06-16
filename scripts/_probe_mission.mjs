import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const r = await p.contentRecord.findFirst({
  where: { path: { contains: 'พันธกิจ' }, language: 'th' },
  select: { id: true, path: true, title: true, contentHtml: true, excerpt: true, language: true }
});
console.log('PATH:', r?.path);
console.log('TITLE:', r?.title);
console.log('LANG:', r?.language);
console.log('EXCERPT:', r?.excerpt);
console.log('---HTML---');
console.log(r?.contentHtml);
await p.$disconnect();
