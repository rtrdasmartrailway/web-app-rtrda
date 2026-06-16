import { prisma } from "@/lib/db/client";
const r = await prisma.contentRecord.findUnique({
  where: { path: "/ผลงานและโครงการเด่น/ฐานข้อมูล-เทคโนโลยี-ระบบ" },
});
if (!r) {
  console.log("NOT FOUND");
  process.exit(1);
}
const imgsrcs = [...r.contentHtml.matchAll(/<img[^>]*src="([^"]+)"/g)].map((m) => m[1]);
const unique = [...new Set(imgsrcs)];
console.log(`Total imgs: ${imgsrcs.length}, unique: ${unique.length}`);

const absUrls = unique.map((u) =>
  u.startsWith("http") ? u : `https://www.rtrda.or.th${u.startsWith("/") ? "" : "/"}${u}`,
);
const results = await Promise.all(
  absUrls.map(async (u) => {
    try {
      const res = await fetch(u, { method: "HEAD" });
      return { url: u, status: res.status, ok: res.ok };
    } catch (e) {
      return { url: u, status: 0, ok: false, error: e.message };
    }
  }),
);
for (const r of results) {
  const fname = r.url.split("/").pop();
  const flag = r.ok ? "✓" : "✗";
  console.log(`  ${flag} HTTP ${r.status}  ${fname}`);
}
const failed = results.filter((r) => !r.ok);
console.log(
  `\nTotal: ${results.length}, OK: ${results.length - failed.length}, Failed: ${failed.length}`,
);

await prisma.$disconnect();
