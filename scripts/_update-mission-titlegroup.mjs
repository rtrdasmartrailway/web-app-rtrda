import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { readFile, writeFile } from 'node:fs/promises';

const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const r = await p.contentRecord.findFirst({
  where: { path: { contains: 'พันธกิจ' }, language: 'th' },
  select: { id: true, path: true, contentHtml: true }
});

if (!r) { console.error('not found'); process.exit(1); }

// Stash backup first
await p.siteMeta.upsert({
  where: { key: 'mission_titlegroup_v1_th' },
  update: { value: r.contentHtml },
  create: { key: 'mission_titlegroup_v1_th', value: r.contentHtml },
});
console.log('BACKED UP. Old length:', r.contentHtml.length);

// Wrap <h3 class="vision-title">...</h3> + <div class="vision-number">NN</div>
// inside <div class="vision-title-group">...</div>
let newHtml = r.contentHtml.replace(
  /(<h3 class="vision-title">[^<]+<\/h3>\s*<div class="vision-number">[^<]+<\/div>)/g,
  '<div class="vision-title-group">$1</div>'
);

const beforeCount = (r.contentHtml.match(/vision-title-group/g) || []).length;
const afterCount = (newHtml.match(/vision-title-group/g) || []).length;
console.log(`Wrap: ${beforeCount} → ${afterCount} (added ${afterCount - beforeCount})`);
console.log('New length:', newHtml.length);

// Update DB
await p.contentRecord.update({
  where: { id: r.id },
  data: { contentHtml: newHtml }
});
console.log('DB updated.');

// Mirror to wp-content.json
const jsonPath = 'src/data/wp-content.json';
const j = JSON.parse(await readFile(jsonPath, 'utf8'));
const idx = j.records.findIndex(x => x.path === r.path);
if (idx === -1) {
  console.error('JSON record not found at path:', r.path);
} else {
  j.records[idx] = { ...j.records[idx], contentHtml: newHtml };
  await writeFile(jsonPath, JSON.stringify(j, null, 2) + '\n');
  console.log('JSON mirrored.');
}

await p.$disconnect();
