import { prisma } from "../src/lib/db/client";

async function main() {
  const rec = await prisma.contentRecord.findFirst({
    where: {
      path: { equals: "/ผลงานและโครงการเด่น/วิจัยและพัฒนา" },
      language: "th",
    },
  });
  if (!rec) {
    // try other variations
    const rec2 = await prisma.contentRecord.findFirst({
      where: {
        title: "วิจัยและพัฒนา",
        language: "th",
      },
    });
    if (!rec2) {
      console.log("not found");
      return;
    }
    console.log("fallback to title match:", rec2.id);
    return inspectAndExit(rec2);
  }
  return inspectAndExit(rec);
}

async function inspectAndExit(rec) {
  console.log(
    JSON.stringify(
      {
        id: rec.id,
        path: rec.path,
        language: rec.language,
        title: rec.title,
        contentLen: rec.contentHtml?.length,
        excerptLen: rec.excerpt?.length,
        excerpt: rec.excerpt?.slice(0, 200),
      },
      null,
      2,
    ),
  );
  console.log("=== CONTENT (full) ===");
  console.log(rec.contentHtml);
  console.log("=== IMAGES in content ===");
  const imgMatches = rec.contentHtml?.match(/<img[^>]+>/g) || [];
  console.log(`Found ${imgMatches.length} img tags`);
  imgMatches.forEach((m, i) => console.log(`  [${i}] ${m.slice(0, 200)}`));
  await prisma.$disconnect();
}
main();
