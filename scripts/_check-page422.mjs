import { prisma } from "@/lib/db/client";
const r = await prisma.contentRecord.findUnique({
  where: { path: "/ผลงานและโครงการเด่น/ฐานข้อมูล-เทคโนโลยี-ระบบ" },
});
if (!r) {
  console.log("NOT FOUND");
} else {
  console.log("path:", r.path);
  console.log("title:", r.title);
  console.log("excerpt.len:", r.excerpt.length);
  console.log("excerpt.preview:", r.excerpt.slice(0, 80).replace(/\n/g, " "));
  console.log("contentHtml.len:", r.contentHtml.length);
}
await prisma.$disconnect();
