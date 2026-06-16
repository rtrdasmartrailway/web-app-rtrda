import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const JSON_PATH = path.resolve('src/data/wp-content.json');
const LEGACY = 'https://www.rtrda.or.th';

const raw = await readFile(JSON_PATH, 'utf8');
let count = { records: 0, srcset: 0, src: 0, href: 0 };

const json = JSON.parse(raw);
for (const rec of json.records) {
  if (typeof rec.contentHtml !== 'string') continue;
  const before = rec.contentHtml;
  rec.contentHtml = rec.contentHtml
    // 1) srcset attribute — comma list of "url sizew" pairs
    .replace(/srcset="([^"]+)"/g, (m, val) => {
      const next = val.replace(
        /(\s|^)(\/wp-content\/uploads\/[^\s,]+)/g,
        (_, sp, url) => `${sp}${LEGACY}${url}`,
      );
      if (next !== val) count.srcset++;
      return `srcset="${next}"`;
    })
    // 2) src / href attributes for wp-content, 3d-flip-book, sdc_download
    .replace(/src="\/wp-content\/uploads\//g, () => {
      count.src++;
      return `src="${LEGACY}/wp-content/uploads/`;
    })
    .replace(/href="\/wp-content\/uploads\//g, () => {
      count.href++;
      return `href="${LEGACY}/wp-content/uploads/`;
    })
    .replace(/href="\/3d-flip-book\//g, () => {
      count.href++;
      return `href="${LEGACY}/3d-flip-book/`;
    })
    .replace(/href="\/sdc_download\//g, () => {
      count.href++;
      return `href="${LEGACY}/sdc_download/`;
    });
  if (before !== rec.contentHtml) count.records++;
}

await writeFile(JSON_PATH, JSON.stringify(json), 'utf8');
console.log('REWRITTEN:', JSON.stringify(count));
console.log('records touched:', count.records);
