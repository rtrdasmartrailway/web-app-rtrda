import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { readFile, writeFile } from "node:fs/promises";

const PAGES = [
  { id: "th-page-414", lang: "th" },
  { id: "en-page-414", lang: "en" },
];

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

for (const { id, lang } of PAGES) {
  const r = await p.contentRecord.findUnique({
    where: { id },
    select: { id: true, path: true, contentHtml: true, language: true },
  });
  if (!r) {
    console.error("not found:", id);
    continue;
  }
  const h = r.contentHtml;

  // Stash backup BEFORE any edit (jsonb)
  const backupKey = "deliv_414_v2_noheading_" + lang + "_backup";
  await p.siteMeta.upsert({
    where: { key: backupKey },
    create: { key: backupKey, value: JSON.stringify(h) },
    update: { value: JSON.stringify(h) },
  });
  console.log("[", id, "] backup stashed:", backupKey, "html len:", h.length);

  // Remove the .deliv-block-header (the badge number + heading) entirely.
  // Keep the structure: .deliv-block > (text + grid).
  // Use a non-greedy match for the header div.
  const headerRe =
    /<div class="deliv-block-header">[\s\S]*?<\/div>\s*(?=<p class="deliv-block-text">)/g;
  const newHtml = h.replace(headerRe, "");

  if (newHtml === h) {
    console.warn("[", id, "] WARNING: replacement did nothing — check HTML structure");
    continue;
  }
  console.log("[", id, "] new html len:", newHtml.length);

  await p.contentRecord.update({
    where: { id },
    data: { contentHtml: newHtml, modified: new Date().toISOString() },
  });
  console.log("[", id, "] updated");

  // Mirror to wp-content.json
  const j = JSON.parse(await readFile("src/data/wp-content.json", "utf8"));
  const idx = j.records.findIndex((x) => x.path === r.path && x.language === lang);
  if (idx >= 0) {
    j.records[idx] = { ...j.records[idx], contentHtml: newHtml };
    await writeFile("src/data/wp-content.json", JSON.stringify(j, null, 2) + "\n");
    console.log("[", id, "] mirrored to wp-content.json");
  } else {
    console.error("[", id, "] record not found in JSON");
  }
}

await p.$disconnect();
console.log("\nDONE.");
