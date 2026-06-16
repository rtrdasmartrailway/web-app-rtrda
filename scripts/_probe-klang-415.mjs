import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const rows = await p.contentRecord.findMany({
  where: { OR: [{ path: { contains: 'คลัง' } }, { title: { contains: 'คลัง' } }], language: 'th' },
  select: { id: true, path: true, title: true, language: true, modified: true },
});
console.log('MATCHES:');
for (const r of rows) console.log(' -', r.path, '|', r.title, '|', r.modified);
await p.$disconnect();
