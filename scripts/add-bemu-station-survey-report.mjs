import { load } from "cheerio";
import pg from "pg";

const pagePath = "/คลังความรู้";
const groupTitle = "รายงานผลงานโครงการ";
const reportTitle =
  "รายงานการสำรวจพื้นที่สถานีเพื่อพิจารณาความเป็นไปได้ในการติดตั้งสถานีชาร์จรถไฟโดยสารพลังงานแบตเตอรี่ (สถานีบ้านแหลม และ สถานีแม่กลอง)";
const reportDescription =
  "โครงการวิจัยและพัฒนารถไฟโดยสารพลังงานไฟฟ้าจากแบตเตอรี่เพื่อลดมลพิษในการเดินรถเข้าสู่ชุมชน";
const reportHref = "/wp-content/uploads/2026/07/bemu-station-survey-report-bl-mk.pdf";
const coverHref = "/wp-content/uploads/2026/07/bemu-station-survey-report-cover.png";
const backupKey = "knowledge_content_backup_before_bemu_station_survey_report";
const coverBackupKey = "knowledge_content_backup_before_bemu_station_survey_cover";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  const result = await client.query(
    'SELECT id, "contentHtml", "searchText" FROM "ContentRecord" WHERE path = $1',
    [pagePath],
  );
  const record = result.rows[0];
  if (!record) {
    throw new Error(`Knowledge page not found: ${pagePath}`);
  }

  const $ = load(record.contentHtml, null, false);
  if (record.contentHtml.includes(reportTitle)) {
    const $reportColumns = $(".wp-block-column").filter(
      (_, column) =>
        $(column).find("h1,h2,h3,h4,h5,h6").first().text().trim() === reportTitle,
    );
    if ($reportColumns.length !== 1) {
      throw new Error(`Expected one existing \"${reportTitle}\" card.`);
    }

    const $reportColumn = $reportColumns.first();
    if (!$reportColumn.find(`img[src="${coverHref}"]`).length) {
      await client.query(
        'INSERT INTO "SiteMeta" (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING',
        [coverBackupKey, JSON.stringify(record.contentHtml)],
      );
      $reportColumn
        .find("h1,h2,h3,h4,h5,h6")
        .first()
        .before(`<figure><img src="${coverHref}" alt="${reportTitle}"></figure>`);
      await client.query(
        'UPDATE "ContentRecord" SET "contentHtml" = $1, modified = $2 WHERE id = $3',
        [$.root().html() ?? "", new Date().toISOString(), record.id],
      );
      console.log("Report cover added.");
    }

    if (!record.searchText.includes(reportTitle)) {
      await client.query('UPDATE "ContentRecord" SET "searchText" = $1 WHERE id = $2', [
        `${record.searchText} ${reportTitle} ${reportDescription}`.trim(),
        record.id,
      ]);
      console.log("Report already exists; search index updated.");
    } else {
      console.log("Report already exists; no database update needed.");
    }
    process.exit(0);
  }

  const $groups = $(".lightweight-accordion").filter(
    (_, accordion) =>
      $(accordion).find("summary.lightweight-accordion-title").first().text().trim() ===
      groupTitle,
  );
  if ($groups.length !== 1) {
    throw new Error(`Expected one \"${groupTitle}\" group, found ${$groups.length}.`);
  }

  const $body = $groups.first().find(".lightweight-accordion-body").first();
  if (!$body.length) {
    throw new Error(`Missing body for \"${groupTitle}\" group.`);
  }

  await client.query(
    'INSERT INTO "SiteMeta" (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING',
    [backupKey, JSON.stringify(record.contentHtml)],
  );

  $body.append(`
    <div class="wp-block-columns is-layout-flex">
      <div class="wp-block-column is-layout-flow">
        <figure><img src="${coverHref}" alt="${reportTitle}"></figure>
        <h6><strong>${reportTitle}</strong></h6>
        <p>${reportDescription}</p>
        <div class="wp-block-button detail-btn"><a class="wp-block-button__link" href="${reportHref}">อ่านเพิ่มเติม</a></div>
        <p class="simple-download-counter"><a class="simple-download-counter-link" href="${reportHref}">ดาวน์โหลดไฟล์</a></p>
      </div>
    </div>
  `);

  await client.query(
    'UPDATE "ContentRecord" SET "contentHtml" = $1, "searchText" = $2, modified = $3 WHERE id = $4',
    [
      $.root().html() ?? "",
      `${record.searchText} ${reportTitle} ${reportDescription}`.trim(),
      new Date().toISOString(),
      record.id,
    ],
  );
  console.log(`Added ${reportTitle} to ${groupTitle}.`);
} finally {
  await client.end();
}
