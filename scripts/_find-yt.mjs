import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
// Search all pages under ผลงานและโครงการเด่น
const all = await p.contentRecord.findMany({
  where: { language: "th" },
  select: { path: true, title: true },
});
for (const r of all) {
  if (
    r.path.startsWith("/ผลงานและโครงการเด่น") ||
    r.path.includes("ยุทธศาสตร์-เทคโนโลยี")
  ) {
    console.log("[" + r.path + "]");
    console.log("  Title:", r.title);
  }
}
await p.$disconnect();
