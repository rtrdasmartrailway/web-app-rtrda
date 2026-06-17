import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const r = await p.contentRecord.findFirst({
  where: { path: { contains: "ค่านิยม" } },
  select: { path: true, title: true, excerpt: true, contentHtml: true },
});
console.log("PATH:", r.path);
console.log("TITLE:", r.title);
console.log("---EXCERPT---");
console.log(r.excerpt);
console.log("---HTML LEN:", r.contentHtml.length);
console.log("---HTML (first 8000)---");
console.log(r.contentHtml.slice(0, 8000));
await p.$disconnect();
