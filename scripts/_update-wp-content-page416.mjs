// Update wp-content.json th-page-416 to match refactored DB
import { prisma } from "@/lib/db/client";
import { readFile, writeFile } from "node:fs/promises";

const PATH = "/ผลงานและโครงการเด่น/มาตรฐาน-ระบบทดสอบ";

const r = await prisma.contentRecord.findUnique({ where: { path: PATH } });
if (!r) {
  console.log("DB NOT FOUND");
  process.exit(1);
}

const jsonPath = "src/data/wp-content.json";
const j = JSON.parse(await readFile(jsonPath, "utf8"));
const idx = j.records.findIndex((x) => x.path === PATH);
if (idx < 0) {
  console.log("JSON NOT FOUND");
  process.exit(1);
}

console.log("Before:");
console.log("  JSON excerpt.len:", (j.records[idx].excerpt || "").length);
console.log("  JSON contentHtml.len:", (j.records[idx].contentHtml || "").length);
console.log("  JSON has wijai-item:", j.records[idx].contentHtml?.includes("wijai-item"));

// Update to match DB
j.records[idx] = {
  ...j.records[idx],
  excerpt: r.excerpt, // cleared ("")
  contentHtml: r.contentHtml, // refactored
};

console.log("After:");
console.log("  JSON excerpt.len:", (j.records[idx].excerpt || "").length);
console.log("  JSON contentHtml.len:", (j.records[idx].contentHtml || "").length);
console.log("  JSON has wijai-item:", j.records[idx].contentHtml?.includes("wijai-item"));
console.log(
  "  JSON has yutth-title:",
  j.records[idx].contentHtml?.includes("yutth-title"),
);
console.log(
  "  JSON has yutth-gallery-3col:",
  j.records[idx].contentHtml?.includes("yutth-gallery-3col"),
);
console.log(
  "  JSON has data-lightbox:",
  j.records[idx].contentHtml?.includes("data-lightbox"),
);

await writeFile(jsonPath, JSON.stringify(j, null, 2) + "\n", "utf8");
console.log(`\nWritten: ${jsonPath}`);

await prisma.$disconnect();
