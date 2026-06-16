import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const r = await p.contentRecord.findFirst({
  where: { path: { contains: 'พันธกิจ' }, language: 'th' },
  select: { id: true, path: true, contentHtml: true, excerpt: true }
});
await p.siteMeta.upsert({
  where: { key: 'mission_zigzag_v1_th' },
  update: { value: r.contentHtml },
  create: { key: 'mission_zigzag_v1_th', value: r.contentHtml },
});
console.log('BACKED UP. contentHtml length:', r.contentHtml.length);
await p.$disconnect();
