import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const r = await p.contentRecord.findUnique({ where: { path: '/คลังความรู้' } });
const html = r.contentHtml;
// Check for ACTUAL relative URLs in srcset (not legacy with /wp-content substring)
const srcsets = [...html.matchAll(/srcset="([^"]+)"/g)].map(m => m[1]);
console.log('TOTAL srcsets:', srcsets.length);
let trulyRelative = 0;
for (const s of srcsets) {
  // Find any url token that doesn't start with http
  const tokens = s.split(',').map(t => t.trim().split(/\s+/)[0]);
  for (const t of tokens) {
    if (t.startsWith('/wp-content') || t.startsWith('/sdc')) {
      trulyRelative++;
      console.log('  BAD:', t);
    }
  }
}
console.log('TRULY RELATIVE TOKENS in srcsets:', trulyRelative);
await p.$disconnect();
