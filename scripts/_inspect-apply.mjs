import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const rec = await p.contentRecord.findFirst({
  where: { path: { contains: "สมัครงาน" } },
  select: { id: true, path: true, title: true, kind: true, parentPath: true },
});
console.log("TARGET:", JSON.stringify(rec, null, 2));

if (rec?.parentPath) {
  const parent = await p.contentRecord.findFirst({
    where: { path: rec.parentPath },
    select: { id: true, path: true, title: true, kind: true },
  });
  console.log("PARENT:", JSON.stringify(parent, null, 2));
}

const children = await p.contentRecord.findMany({
  where: { parentPath: rec.path, kind: "page" },
  select: { id: true, path: true, title: true, kind: true },
});
console.log("CHILDREN of target:", JSON.stringify(children, null, 2));

if (rec?.parentPath) {
  const childrenOfParent = await p.contentRecord.findMany({
    where: { parentPath: rec.parentPath, kind: "page" },
    select: { id: true, path: true, title: true, kind: true },
  });
  console.log("CHILDREN of parent:", JSON.stringify(childrenOfParent, null, 2));
}

await p.$disconnect();
