import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const r = await p.contentRecord.findUnique({
  where: { path: "/คลังความรู้" },
  select: {
    id: true,
    path: true,
    title: true,
    contentHtml: true,
    excerpt: true,
    modified: true,
  },
});
console.log("TITLE:", r?.title);
console.log("CONTENT LENGTH:", r?.contentHtml?.length);
console.log("MODIFIED:", r?.modified);
console.log("--- contentHtml (first 2000) ---");
console.log((r?.contentHtml ?? "").slice(0, 2000));
console.log("--- EXCERPT ---");
console.log(r?.excerpt);
await p.$disconnect();
