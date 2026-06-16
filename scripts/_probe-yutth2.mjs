import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
// Try various path fragments
const r1 = await p.contentRecord.findMany({
  where: { OR: [
    { path: { contains: 'ยุทธศาสตร์' }, language: 'th' },
    { title: { contains: 'ยุทธศาสตร์เทคโนโลยี' }, language: 'th' },
  ] },
  select: { id: true, path: true, title: true, language: true },
});
console.log('YUTTH RECORDS:', JSON.stringify(r1, null, 2));
// Check for typo'd path variations
const r2 = await p.contentRecord.findFirst({
  where: { path: { contains: 'เทคโนโลยี' } },
  select: { id: true, path: true, title: true, language: true },
});
console.log('TECHNOLOGY MATCH:', JSON.stringify(r2, null, 2));
await p.$disconnect();
