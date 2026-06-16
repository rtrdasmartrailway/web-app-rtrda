import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
// Restore the v0 (original) contentHtml
const v0 = await p.siteMeta.findUnique({ where: { key: 'klang415_content_backup_v1_th' } });
if (!v0) { console.error('backup not found'); process.exit(1); }
// Read the original HTML from JSON (the seed source of truth)
const json = JSON.parse((await import('node:fs/promises')).readFileSync('src/data/wp-content.json', 'utf8'));
const orig = json.records.find(r => r.path === '/คลังความรู้');
if (!orig) { console.error('not in JSON'); process.exit(1); }
await p.contentRecord.update({
  where: { path: '/คลังความรู้' },
  data: { contentHtml: orig.contentHtml, modified: new Date().toISOString() },
});
console.log('RESET klang-415 to JSON version. length:', orig.contentHtml.length);
await p.$disconnect();
