import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const keys = await p.siteMeta.findMany({ where: { key: { contains: 'klang' } }, select: { key: true } });
for (const k of keys) console.log(' -', k.key);
await p.$disconnect();
