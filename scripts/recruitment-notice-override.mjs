import { load } from "cheerio";

const FORM_URL = "https://forms.gle/z3abJcX9QRk8zGGA7";
const PREVIOUS_PDF_URL =
  "/recruitment-documents/recruitment-policy-planning-support-2569.pdf";
const PDF_PATH = "/recruitment-documents/recruitment-staff-selection-2-2569.pdf";
const PDF_URL = `${PDF_PATH}?v=20261028-65fb0227-inline-v2`;
const PREVIOUS_POSITION_TITLE =
  "ประกาศเปิดรับสมัครงาน ตำแหน่ง เจ้าหน้าที่สนับสนุนงานนโยบายและแผน (จ้างเหมาบริการ)";
const POSITION_TITLE =
  "ประกาศสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) เรื่อง รับสมัครบุคคลเพื่อคัดเลือกและบรรจุแต่งตั้งเป็นเจ้าหน้าที่ ครั้งที่ 2/2569";

const NOTICE_ROW = `<tr><td class="has-text-align-center col-0 col-align-center" data-align="center">1</td><td class="has-text-align-center col-1 col-align-center" data-align="center">26 ตุลาคม 2569</td><td class="has-text-align-left col-2 col-align-left" data-align="left">${POSITION_TITLE}</td><td class="has-text-align-center col-3 col-align-center" data-align="center">10</td><td class="has-text-align-center col-4 col-align-left" data-align="left">–</td><td class="has-text-align-center col-5 col-align-center" data-align="center"><a href="${PDF_URL}" target="_blank" rel="noreferrer noopener">PDF</a></td></tr>`;
const PREVIOUS_NOTICE_ROW = `<tr><td class="has-text-align-center col-0 col-align-center" data-align="center">2</td><td class="has-text-align-center col-1 col-align-center" data-align="center">28 กันยายน 2569</td><td class="has-text-align-left col-2 col-align-left" data-align="left">${PREVIOUS_POSITION_TITLE}</td><td class="has-text-align-center col-3 col-align-center" data-align="center">1</td><td class="has-text-align-center col-4 col-align-left" data-align="left"><a href="${FORM_URL}" target="_blank" rel="noreferrer noopener">สมัครงาน</a></td><td class="has-text-align-center col-5 col-align-center" data-align="center"><a href="${PREVIOUS_PDF_URL}" target="_blank" rel="noreferrer noopener">PDF</a></td></tr>`;

export function addRecruitmentNotice(contentHtml) {
  if (contentHtml.includes(PDF_URL)) return contentHtml;

  let updatedExistingNotice = false;
  const refreshedContent = contentHtml.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi, (row) => {
    if (!row.includes(POSITION_TITLE)) return row;

    const refreshedRow = row.replace(
      /(\bhref=["'])\/recruitment-documents\/recruitment-staff-selection-2-2569\.pdf(?:\?[^"']*)?(["'])/i,
      `$1${PDF_URL}$2`,
    );
    if (refreshedRow !== row) updatedExistingNotice = true;
    return refreshedRow;
  });
  if (updatedExistingNotice) return refreshedContent;

  const hasPreviousNotice = contentHtml.includes(FORM_URL);
  const rowsToAdd = hasPreviousNotice
    ? NOTICE_ROW
    : `${NOTICE_ROW}${PREVIOUS_NOTICE_ROW}`;
  const numberOffset = hasPreviousNotice ? 1 : 2;

  let foundTableBody = false;
  const updated = contentHtml.replace(
    /(<tbody\b[^>]*>)([\s\S]*?)(<\/tbody>)/i,
    (_match, open, rows, close) => {
      foundTableBody = true;
      const renumberedRows = rows.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi, (row) =>
        row.replace(
          /(<td\b[^>]*>)(\s*)(\d+)(\s*)(<\/td>)/i,
          (_cell, start, before, number, after, end) =>
            `${start}${before}${Number(number) + numberOffset}${after}${end}`,
        ),
      );
      return `${open}${rowsToAdd}${renumberedRows}${close}`;
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
