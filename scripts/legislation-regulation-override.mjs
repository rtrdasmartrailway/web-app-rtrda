import { load } from "cheerio";

const PAGE_PATH = "/เกี่ยวกับ-สทร/กฏหมาย-ระเบียบ-ข้อบังคับ";
const OLD_TITLE =
  "ระเบียบคณะกรรมการสถาบันวิจัยและพัฒนาเทคโนโลยีระบบรางว่าด้วยหลักเกณฑ์และวิธีสรรหาผู้อำนวยการ สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง พ.ศ. 2564";
const NEW_TITLE =
  "ระเบียบคณะกรรมการสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง ว่าด้วยหลักเกณฑ์และวิธีการสรรหาผู้อำนวยการสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง พ.ศ. 2569";
const PDF_URL = "/recruitment-director-regulation-2569.pdf";

export function updateDirectorRegulation(contentHtml) {
  const $ = load(contentHtml, null, false);
  const rows = $("tbody tr").filter((_index, row) => {
    const title = $(row)
      .find("td")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();
    return title === OLD_TITLE || title === NEW_TITLE;
  });

  if (rows.length !== 1) {
    throw new Error(
      `Expected one director regulation row, found ${rows.length}`,
    );
  }

  const cells = rows.first().find("td");
  const link = cells.eq(1).find("a").first();
  if (cells.length < 2 || link.length !== 1) {
    throw new Error("Director regulation download link was not found");
  }

  cells.first().text(NEW_TITLE);
  link.attr("href", PDF_URL);
  return $.html();
}

export async function applyDirectorRegulationOverride(client) {
  const result = await client.query(
    'SELECT "id", "contentHtml" FROM "ContentRecord" WHERE "path" = $1 FOR UPDATE',
    [PAGE_PATH],
  );
  if (result.rowCount !== 1) {
    throw new Error("Thai legislation page was not found");
  }

  const contentHtml = updateDirectorRegulation(result.rows[0].contentHtml);
  const plainText = load(contentHtml).text().replace(/\s+/g, " ").trim();
  const excerpt =
    plainText.length > 160 ? `${plainText.slice(0, 157)}…` : plainText;

  await client.query(
    'UPDATE "ContentRecord" SET "contentHtml" = $1, "excerpt" = $2, "searchText" = $3, "modified" = $4 WHERE "id" = $5',
    [
      contentHtml,
      excerpt,
      plainText,
      new Date().toISOString(),
      result.rows[0].id,
    ],
  );
}
