import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const r = await p.contentRecord.findUnique({ where: { path: '/ผลงานและโครงการเด่น/ยุทธศาสตร์-เทคโนโลยี-ระบ' } });
if (!r) { console.error('not found'); process.exit(1); }
console.log('LENGTH:', r.contentHtml.length);
console.log('---');
console.log(r.contentHtml);
await p.$disconnect();
