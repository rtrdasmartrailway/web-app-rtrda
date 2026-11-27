import * as cheerio from "cheerio";
import type { WpContentRecord } from "./types";
import { normalizeRoutePath } from "./url";

const PROCUREMENT_PLAN_PATH = "/จัดซื้อจัดจ้าง/แผนการจัดซื้อจัดจ้าง";
const PROCUREMENT_PLAN_YEAR = "ปี 2569";
const PROCUREMENT_PLAN_ROWS_2570 = [
  {
    date: "23 พฤศจิกายน 2569",
    project: "เช่ารถยนต์ไฟฟ้า จำนวน 1 คัน",
    href: "/procurement-documents/procurement-plan-2570-25691123.pdf",
  },
  {
    date: "30 ตุลาคม 2569",
    project:
      "เช่าพื้นที่อาคารสถานที่สำนักงานสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง(องค์การมหาชน)",
    href: "/procurement-documents/procurement-plan-2570-25691030.pdf",
  },
];
const PROCUREMENT_PLAN_ROWS_2569: Array<{
  date: string;
  project: string;
  href: string;
  previousProject?: string;
}> = [
  {
    date: "3 กันยายน 2569",
    project: "เช่ายานพาหนะ (รถตู้โดยสารขนาด 12 ที่นั่ง) จำนวน 1 คัน",
    previousProject: "เผยแพร่แผนการจัดซื้อจัดจ้าง ประจำปีงบประมาณ พ.ศ. 2570",
    href: "/wp-content/uploads/2026/09/procurement-plan-fiscal-year-2570-25690903.pdf",
  },
  {
    date: "23 กรกฎาคม 2569",
    project:
      "จ้างที่ปรึกษาโครงการส่งเสริมการแข่งขันและส่งเสริมสภาพแวดล้อมระบบรางเพื่อส่งเสริมการใช้งานระบบราง",
    href: "/wp-content/uploads/2026/07/procurement-plan-rail-competition-25690723.pdf",
  },
  {
    date: "16 กรกฎาคม 2569",
    project:
      "จ้างที่ปรึกษาศึกษาพัฒนา Algorithm เพื่อตรวจจับและแจ้งเตือนการฝ่าฝืนไม้กั้นทางรถไฟ ณ จุดตัดทางรถไฟแนวระดับ",
    href: "/wp-content/uploads/2026/07/ประกาศแผนจัดซื้อจัดจ้าง_16_07_2569.pdf?v=20260716",
  },
];

function isProcurementPlanPath(path: string): boolean {
  return normalizeRoutePath(path) === PROCUREMENT_PLAN_PATH;
}

export function applyProcurementPlanOverride(record: WpContentRecord): WpContentRecord {
  if (!isProcurementPlanPath(record.path)) {
    return record;
  }

  const $ = cheerio.load(record.contentHtml, null, false);
  const accordion = $(".lightweight-accordion")
    .filter((_, element) =>
      $(element).find("summary").first().text().trim().includes(PROCUREMENT_PLAN_YEAR),
    )
    .first();

  const rows = accordion.find("tbody tr");
  if (rows.length === 0) {
    return record;
  }

  let changed = false;
  const hasYear2570 = $(".lightweight-accordion")
    .toArray()
    .some((element) =>
      $(element).find("summary").first().text().trim().includes("ปี 2570"),
    );
  if (!hasYear2570) {
    const newAccordion = accordion.clone();
    newAccordion.find("summary h1").first().text("ปี 2570");
    const body = newAccordion.find("tbody").first().empty();
    PROCUREMENT_PLAN_ROWS_2570.forEach(({ date, project, href }, index) => {
      const row = $("<tr></tr>");
      for (const value of [String(index + 1), date, project, "เผยแพร่ขึ้นเว็บ"]) {
        row.append($("<td></td>").text(value));
      }
      row.append(
        $("<td></td>").append(
          $("<a></a>")
            .attr("href", href)
            .attr("target", "_blank")
            .attr("rel", "noreferrer noopener")
            .text("PDF"),
        ),
      );
      body.append(row);
    });
    accordion.before(newAccordion);
    changed = true;
  } else {
    const year2570 = $(".lightweight-accordion")
      .filter((_, element) =>
        $(element).find("summary").first().text().trim().includes("ปี 2570"),
      )
      .first();
    for (const { date, project } of PROCUREMENT_PLAN_ROWS_2570) {
      const existingRow = year2570
        .find("tbody tr")
        .filter((_, row) => $(row).find("td").eq(1).text().trim() === date)
        .first();
      const projectCell = existingRow.find("td").eq(2);
      if (projectCell.length > 0 && projectCell.text().trim() !== project) {
        projectCell.text(project);
        changed = true;
      }
    }
  }
  for (const plan of [...PROCUREMENT_PLAN_ROWS_2569].reverse()) {
    const existingRow = rows
      .filter((_, row) => {
        const text = $(row).text();
        return (
          text.includes(plan.project) ||
          Boolean(plan.previousProject && text.includes(plan.previousProject))
        );
      })
      .first();
    if (existingRow.length > 0) {
      const projectCell = existingRow.find("td").eq(2);
      if (projectCell.text().trim() !== plan.project) {
        projectCell.text(plan.project);
        changed = true;
      }
      continue;
    }

    const row = $("<tr></tr>");
    row.append($("<td></td>"));
    row.append($("<td></td>").text(plan.date));
    row.append($("<td></td>").text(plan.project));
    row.append($("<td></td>").text("เผยแพร่ขึ้นเว็บ"));
    row.append(
      $("<td></td>").append(
        $("<a></a>")
          .attr("href", plan.href)
          .attr("target", "_blank")
          .attr("rel", "noreferrer noopener")
          .text("PDF"),
      ),
    );
    accordion.find("tbody tr").first().before(row);
    changed = true;
  }

  accordion.find("tbody tr").each((index, row) => {
    const firstCell = $(row).find("td").first();
    const nextNumber = String(index + 1);
    if (firstCell.text().trim() !== nextNumber) {
      firstCell.text(nextNumber);
      changed = true;
    }
  });

  if (!changed) return record;

  return {
    ...record,
    contentHtml: $.html(),
  };
}
