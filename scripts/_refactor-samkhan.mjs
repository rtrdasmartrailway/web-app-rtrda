// Refactor the apply (สมัครงาน) table HTML in DB:
// 1. Move body rows from <thead> into <tbody>
// 2. Change <th> -> <td> in body rows
// 3. Add <colgroup> with explicit column widths (prevents overflow)
// 4. Add classes for cell alignment
// 5. Add a class to the link cells so CSS can style URLs
//
// Idempotent: detect <thead> that contains >1 row and split.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ID = "th-page-442";

const COLUMN_WIDTHS = [60, 130, null, 70, 180, 90];
const COLUMN_ALIGNS = ["center", "left", "left", "center", "left", "center"];

function refactorTable(html) {
  // Find <table>...</table>
  const tableMatch = html.match(
    /(<figure[^>]*>)?<table>([\s\S]*?)<\/table>(<\/figure>)?/,
  );
  if (!tableMatch) return { html, changed: false, reason: "no table" };

  const figureOpen = tableMatch[1] ?? "";
  const figureClose = tableMatch[3] ?? "";
  const inner = tableMatch[2];

  // Extract <thead>...</thead>
  const theadMatch = inner.match(/<thead>([\s\S]*?)<\/thead>/);
  if (!theadMatch) return { html, changed: false, reason: "no thead" };
  const theadInner = theadMatch[1];

  // Extract all <tr>...</tr> in thead
  const trRegex = /<tr>([\s\S]*?)<\/tr>/g;
  const trs = [];
  let m;
  while ((m = trRegex.exec(theadInner)) !== null) trs.push(m[0]);
  if (trs.length === 0) return { html, changed: false, reason: "no rows" };
  if (trs.length === 1)
    return { html, changed: false, reason: "only 1 row (header only)" };

  // First row = header (keep <th>), rest = body (convert <th> to <td>)
  const [headerRow, ...bodyRows] = trs;
  const convertedBody = bodyRows
    .map((row) => {
      // Convert <th ...> ... </th> -> <td ...> ... </td> (only direct, not nested)
      return row.replace(/<th\b/g, "<td").replace(/<\/th>/g, "</td>");
    })
    .join("");

  // Build colgroup
  const colgroup = `<colgroup>${COLUMN_WIDTHS.map((w) =>
    w == null ? "<col>" : `<col style="width:${w}px">`,
  ).join("")}</colgroup>`;

  // Add data-col attribute to each <td>/<th> for CSS alignment
  // We'll inject via the header row pattern (each <th>/<td> inside it).
  function annotateCells(row) {
    let i = 0;
    return row.replace(/<(t[hd])\b([^>]*)>/g, (full, tag, attrs) => {
      const idx = i++;
      const align = COLUMN_ALIGNS[idx] ?? "left";
      // Replace existing class="..." with new combined class, or add new class=
      let newAttrs;
      if (/\bclass\s*=\s*"([^"]*)"/.test(attrs)) {
        newAttrs = attrs.replace(
          /\bclass\s*=\s*"([^"]*)"/,
          `class="$1 col-${idx} col-align-${align}"`,
        );
      } else {
        newAttrs = ` class="col-${idx} col-align-${align}"` + attrs;
      }
      return `<${tag}${newAttrs}>`;
    });
  }

  const newHeader = annotateCells(headerRow);
  const newBody = annotateCells(convertedBody);

  const newInner = colgroup + `<thead>${newHeader}</thead>` + `<tbody>${newBody}</tbody>`;

  const newTable = `${figureOpen}<table>${newInner}</table>${figureClose}`;

  const newHtml = html.replace(tableMatch[0], newTable);
  return { html: newHtml, changed: newHtml !== html, reason: "ok" };
}

const rec = await p.contentRecord.findUnique({
  where: { id: ID },
  select: { id: true, path: true, contentHtml: true },
});
if (!rec) {
  console.error("Record not found:", ID);
  process.exit(1);
}

const { html: newHtml, changed, reason } = refactorTable(rec.contentHtml);
console.log("Reason:", reason);
console.log("Changed:", changed);
console.log("Old length:", rec.contentHtml.length);
console.log("New length:", newHtml.length);

if (changed) {
  // Save backup
  console.log("\n=== DIFF (first 800 chars) ===");
  console.log("OLD:", rec.contentHtml.slice(0, 800));
  console.log("\nNEW:", newHtml.slice(0, 800));

  await p.contentRecord.update({
    where: { id: ID },
    data: { contentHtml: newHtml },
  });
  console.log("\n✅ Updated");
} else {
  console.log("\nNo changes made.");
}

await p.$disconnect();
