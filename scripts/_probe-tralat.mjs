import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
// Find the record by title match (path may be truncated)
const r = await p.contentRecord.findFirst({
  where: { title: { contains: "ตราสัญลักษณ์" }, language: "th" },
  select: { id: true, path: true, title: true, language: true, contentHtml: true },
});
if (!r) {
  console.error("not found");
  process.exit(1);
}
console.log("PATH:", r.path);
console.log("TITLE:", r.title);
console.log("LANG:", r.language);
console.log("LENGTH:", r.contentHtml?.length);
console.log("--- contentHtml (first 3000) ---");
console.log(r.contentHtml?.slice(0, 3000));
await p.$disconnect();
