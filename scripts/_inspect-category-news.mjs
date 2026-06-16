import { prisma } from "@/lib/db/client";
import { readFile } from "node:fs/promises";

const j = JSON.parse(await readFile("src/data/wp-content.json", "utf8"));

// Parse contentHtml to extract news links
const r = await prisma.contentRecord.findUnique({
  where: { path: "/category/ข่าวและกิจกรรม" },
});
const liMatches = [...r.contentHtml.matchAll(/<li>([\s\S]*?)<\/li>/g)];
const newsPaths = [];
for (const m of liMatches) {
  const aMatch = m[1].match(/<a\s+href="([^"]+)"/);
  if (aMatch) newsPaths.push(aMatch[1]);
}
console.log(`News paths: ${newsPaths.length}`);

// Find each news record + check featuredMediaId
for (const p of newsPaths) {
  const rec = await prisma.contentRecord.findUnique({ where: { path: p } });
  if (!rec) {
    console.log(`  ${p}: NOT FOUND`);
    continue;
  }
  console.log(`  ${p}`);
  console.log(`    title: ${rec.title.slice(0, 50)}`);
  console.log(`    kind: ${rec.kind}`);
  console.log(`    featuredMediaId: ${rec.featuredMediaId}`);
  console.log(`    excerpt.len: ${rec.excerpt.length}`);
  console.log(`    date: ${rec.date}`);
  if (rec.featuredMediaId) {
    const media = await prisma.mediaAsset.findUnique({
      where: { id: String(rec.featuredMediaId) },
    });
    if (media) {
      console.log(`    media.fileName: ${media.fileName}`);
      console.log(`    media.mimeType: ${media.mimeType}`);
      console.log(`    media.localPath: ${media.localPath}`);
    }
  }
}

await prisma.$disconnect();
