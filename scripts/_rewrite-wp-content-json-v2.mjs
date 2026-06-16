import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const JSON_PATH = path.resolve('src/data/wp-content.json');
const LEGACY = 'https://www.rtrda.or.th';

const raw = await readFile(JSON_PATH, 'utf8');
const json = JSON.parse(raw);
const count = { records: 0, srcset: 0, src: 0, href: 0, srcEN: 0, hrefEN: 0 };

for (const rec of json.records) {
  if (typeof rec.contentHtml !== 'string') continue;
  const before = rec.contentHtml;
  rec.contentHtml = rec.contentHtml
    // 1) srcset — th and en paths
    .replace(/srcset="([^"]+)"/g, (m, val) => {
      let next = val
        .replace(/(\s|^)(\/wp-content\/uploads\/[^\s,]+)/g, (_, sp, url) => `${sp}${LEGACY}${url}`)
        .replace(/(\s|^)(\/en\/wp-content\/uploads\/[^\s,]+)/g, (_, sp, url) => `${sp}${LEGACY}${url}`)
        .replace(/(\s|^)(\/en\/wp-content\/[^\s,]+)/g, (_, sp, url) => `${sp}${LEGACY}${url}`);
      if (next !== val) count.srcset++;
      return `srcset="${next}"`;
    })
    // 2) src — wp-content (th/en)
    .replace(/src="\/wp-content\/uploads\//g, () => { count.src++; return `src="${LEGACY}/wp-content/uploads/`; })
    .replace(/src="\/en\/wp-content\/uploads\//g, () => { count.srcEN++; return `src="${LEGACY}/wp-content/uploads/`; })
    // 3) href — wp-content, 3d-flip-book (th/en), sdc_download (th/en)
    .replace(/href="\/wp-content\/uploads\//g, () => { count.href++; return `href="${LEGACY}/wp-content/uploads/`; })
    .replace(/href="\/3d-flip-book\//g, () => { count.href++; return `href="${LEGACY}/3d-flip-book/`; })
    .replace(/href="\/sdc_download\//g, () => { count.href++; return `href="${LEGACY}/sdc_download/`; })
    .replace(/href="\/en\/wp-content\/uploads\//g, () => { count.hrefEN++; return `href="${LEGACY}/wp-content/uploads/`; })
    .replace(/href="\/en\/3d-flip-book\//g, () => { count.hrefEN++; return `href="${LEGACY}/3d-flip-book/`; })
    .replace(/href="\/en\/sdc_download\//g, () => { count.hrefEN++; return `href="${LEGACY}/sdc_download/`; });
  if (before !== rec.contentHtml) count.records++;
}

await writeFile(JSON_PATH, JSON.stringify(json), 'utf8');
console.log('REWRITTEN:', JSON.stringify(count));
