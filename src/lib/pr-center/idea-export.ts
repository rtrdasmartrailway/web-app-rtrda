export type ContentIdeaExportRow = {
  id: string;
  title: string;
  summary: string;
  channels: string;
  priority: string;
  status: string;
  author: string;
  links: string[];
};

const HEADERS = [
  "ID",
  "หัวข้อ Content",
  "เนื้อหา / รายละเอียด Content",
  "ช่องทาง",
  "ระดับความสำคัญ",
  "สถานะไอเดีย",
  "ผู้บันทึก",
  "Link / Folder โครงการ",
];

function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function createContentIdeasCsv(rows: ContentIdeaExportRow[]): string {
  return (
    "\uFEFF" +
    [
      HEADERS,
      ...rows.map((row) => [
        row.id,
        row.title,
        row.summary,
        row.channels,
        row.priority,
        row.status,
        row.author,
        row.links.join(" | "),
      ]),
    ]
      .map((line) => line.map((value) => csvCell(String(value))).join(","))
      .join("\r\n")
  );
}

export function createContentIdeasWordHtml(rows: ContentIdeaExportRow[]): string {
  const tableRows = rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.id)}</td><td>${escapeHtml(row.title)}</td><td>${escapeHtml(row.summary)}</td><td>${escapeHtml(row.channels)}</td><td>${escapeHtml(row.priority)}</td><td>${escapeHtml(row.status)}</td><td>${escapeHtml(row.author)}</td><td>${row.links.map((link) => `<div>${escapeHtml(link)}</div>`).join("")}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>Content Ideas</title><style>body{font-family:Arial,sans-serif;color:#172033}h1{font-size:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d7dee9;padding:8px;text-align:left;vertical-align:top}th{background:#512265;color:#fff;font-weight:700}</style></head><body><h1>เสนอ Content Ideas</h1><table><thead><tr>${HEADERS.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
}
