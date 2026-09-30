import { load } from "cheerio";

const FORM_URL = "https://forms.gle/z3abJcX9QRk8zGGA7";
const PDF_URL = "/recruitment-documents/recruitment-policy-planning-support-2569.pdf";
const POSITION_TITLE =
  "ประกาศเปิดรับสมัครงาน ตำแหน่ง เจ้าหน้าที่สนับสนุนงานนโยบายและแผน (จ้างเหมาบริการ)";

const NOTICE_ROW = `<tr><td class="has-text-align-center col-0 col-align-center" data-align="center">1</td><td class="has-text-align-center col-1 col-align-center" data-align="center">28 กันยายน 2569</td><td class="has-text-align-left col-2 col-align-left" data-align="left">${POSITION_TITLE}</td><td class="has-text-align-center col-3 col-align-center" data-align="center">1</td><td class="has-text-align-center col-4 col-align-left" data-align="left"><a href="${FORM_URL}" target="_blank" rel="noreferrer noopener">สมัครงาน</a></td><td class="has-text-align-center col-5 col-align-center" data-align="center"><a href="${PDF_URL}" target="_blank" rel="noreferrer noopener">PDF</a></td></tr>`;

export function addRecruitmentNotice(contentHtml) {
  if (contentHtml.includes(FORM_URL)) return contentHtml;

  let foundTableBody = false;
  const updated = contentHtml.replace(
    /(<tbody\b[^>]*>)([\s\S]*?)(<\/tbody>)/i,
    (_match, open, rows, close) => {
      foundTableBody = true;
      const renumberedRows = rows.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi, (row) =>
        row.replace(
          /(<td\b[^>]*>)(\s*)(\d+)(\s*)(<\/td>)/i,
          (_cell, start, before, number, after, end) =>
            `${start}${before}${Number(number) + 1}${after}${end}`,
        ),
      );
      return `${open}${NOTICE_ROW}${renumberedRows}${close}`;
    },
  );

  if (!foundTableBody) {
    throw new Error("Recruitment page table body was not found");
  }

  return updated;
}

export async function applyRecruitmentNoticeOverride(client) {
  const result = await client.query(
    'SELECT "contentHtml" FROM "ContentRecord" WHERE "id" = $1 FOR UPDATE',
    ["th-page-442"],
  );
  if (result.rowCount !== 1) {
    throw new Error("Thai recruitment page th-page-442 was not found");
  }

  const contentHtml = addRecruitmentNotice(result.rows[0].contentHtml);
  const plainText = load(contentHtml).text().replace(/\s+/g, " ").trim();
  const excerpt = plainText.length > 160 ? `${plainText.slice(0, 157)}…` : plainText;

  await client.query(
    'UPDATE "ContentRecord" SET "contentHtml" = $1, "excerpt" = $2, "searchText" = $3 WHERE "id" = $4',
    [contentHtml, excerpt, plainText, "th-page-442"],
  );
}
