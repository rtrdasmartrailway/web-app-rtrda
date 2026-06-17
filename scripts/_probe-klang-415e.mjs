import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const r = await p.contentRecord.findUnique({
  where: { path: "/คลังความรู้" },
  select: { contentHtml: true },
});
const links = [
  ...new Set(
    [
      ...r.contentHtml.matchAll(
        /<a[^>]+href="(\/sdc_download\/\d+|\/3d-flip-book\/[^"]+)"/g,
      ),
    ].map((m) => m[1]),
  ),
];
console.log("UNIQUE DOWNLOAD/READ LINKS:", links.length);
// Test legacy on first 20
let ok = 0,
  fail = 0;
const failures = [];
for (const href of links) {
  const url = "https://www.rtrda.or.th" + href;
  try {
    const resp = await fetch(url, { method: "GET", redirect: "manual" });
    const code = resp.status;
    if (code < 400) ok++;
    else {
      fail++;
      failures.push(`${code}  ${href}`);
    }
  } catch {
    fail++;
    failures.push(`ERR  ${href}`);
  }
}
console.log(`OK: ${ok} / FAIL: ${fail}`);
console.log("FAILURES:");
for (const f of failures.slice(0, 20)) console.log(" -", f);
await p.$disconnect();
