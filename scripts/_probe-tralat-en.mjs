import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const r = await p.contentRecord.findFirst({
  where: { title: { contains: "ตราสัญลักษณ์" }, language: "en" },
});
if (!r) {
  console.error("not found");
  process.exit(1);
}
console.log("PATH:", r.path);
console.log("LENGTH:", r.contentHtml?.length);
console.log("--- contentHtml (first 1500) ---");
console.log(r.contentHtml?.slice(0, 1500));
await p.$disconnect();
