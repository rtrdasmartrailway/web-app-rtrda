import { load } from "cheerio";
import pg from "pg";

const pagePath = "/คลังความรู้";
const reportTitle =
  "รายงานสรุปการลงพื้นที่ภาคสนามโครงการวิจัยและพัฒนาต้นแบบ ระบบรถไฟฟ้ารางเบาโดยใช้ชิ้นส่วนที่ผลิตภายในประเทศ";
const previousCoverHref =
  "/wp-content/uploads/2023/11/รายงานสรุปการลงพื้นที่ภาคสนาม-จังหวัดขอนแก่น_Page_01-copy-724x1024.webp";
const replacementCoverHref =
  "/wp-content/uploads/2026/07/bemu-station-survey-report-cover.png";
const backupKey = "knowledge_content_backup_before_light_rail_project_report_cover";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  const result = await client.query(
    'SELECT id, "contentHtml" FROM "ContentRecord" WHERE path = $1',
    [pagePath],
  );
  const record = result.rows[0];
  if (!record) {
    throw new Error(`Knowledge page not found: ${pagePath}`);
  }

  const $ = load(record.contentHtml, null, false);
  const $reportColumns = $(".wp-block-column").filter(
    (_, column) =>
      $(column).find("h1,h2,h3,h4,h5,h6").first().text().trim() === reportTitle,
  );
  if ($reportColumns.length !== 1) {
    throw new Error(`Expected one \"${reportTitle}\" card.`);
  }

  const $cover = $reportColumns.first().find("img").first();
  if (!$cover.length) {
    throw new Error(`Cover image not found for \"${reportTitle}\".`);
  }
  if ($cover.attr("src") === replacementCoverHref) {
    console.log("Project report cover already uses the replacement image.");
    process.exit(0);
  }
  if ($cover.attr("src") !== previousCoverHref) {
    throw new Error(`Unexpected existing cover path: ${$cover.attr("src")}`);
  }

  await client.query(
    'INSERT INTO "SiteMeta" (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING',
    [backupKey, JSON.stringify(record.contentHtml)],
  );
  $cover.attr("src", replacementCoverHref).attr("alt", reportTitle);
  await client.query(
    'UPDATE "ContentRecord" SET "contentHtml" = $1, modified = $2 WHERE id = $3',
    [$.root().html() ?? "", new Date().toISOString(), record.id],
  );
  console.log("Project report cover updated.");
} finally {
  await client.end();
}
