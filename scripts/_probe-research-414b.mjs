import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const r = await p.contentRecord.findUnique({
  where: { path: '/ผลงานและโครงการเด่น/วิจัย-นวัตกรรม' },
  select: { id: true, path: true, title: true, contentHtml: true },
});
console.log('TITLE:', r?.title);
console.log('--- contentHtml ---');
console.log(r?.contentHtml);
await p.$disconnect();
