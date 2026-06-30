import { normalizeRoutePath } from "./url";
import type { KnowledgeDocumentGroup } from "./knowledge-documents";

export const moralityReportPath = "/เอกสารเผยแพร่/รายงานประเมินคุณธรรมฯ";
export const moralityReportTitle = "รายงานประเมินคุณธรรมฯ";

export const moralityReportGroups: KnowledgeDocumentGroup[] = [
  {
    title: "การประเมินความเสี่ยงด้านการเบิกจ่ายเงินงบประมาณ",
    open: true,
    documents: [
      {
        title: "การประเมินความเสี่ยงการทุจริตในหน่วยงานภาครัฐ ประจำปีงบประมาณ พ.ศ. 2569",
        description: "เอกสารรายงานประเมินคุณธรรมฯ รูปแบบ PDF",
        coverImage: null,
        coverAlt: "",
        previewHref:
          "/wp-content/uploads/morality-report-evaluation/budget-risk-assessment-01-การประเมินความเสี่ยงการทุจริตในหน่วยงานภาครัฐ-ประจำปีงบประมาณ-พ.ศ.-2569.pdf",
        downloadHref:
          "/wp-content/uploads/morality-report-evaluation/budget-risk-assessment-01-การประเมินความเสี่ยงการทุจริตในหน่วยงานภาครัฐ-ประจำปีงบประมาณ-พ.ศ.-2569.pdf",
        hasUsableTarget: true,
      },
      {
        title: "ประเมินความเสี่ยงด้านการทุจริตฯ ด้านการเบิกจ่ายเงินงบประมาณ",
        description: "เอกสารรายงานประเมินคุณธรรมฯ รูปแบบ PDF",
        coverImage: null,
        coverAlt: "",
        previewHref:
          "/wp-content/uploads/morality-report-evaluation/budget-risk-assessment-02-ประเมินความเสี่ยงด้านการทุจริตฯ-ด้านการเบิกจ่ายเงินงบประมาณ.pdf",
        downloadHref:
          "/wp-content/uploads/morality-report-evaluation/budget-risk-assessment-02-ประเมินความเสี่ยงด้านการทุจริตฯ-ด้านการเบิกจ่ายเงินงบประมาณ.pdf",
        hasUsableTarget: true,
      },
    ],
  },
  {
    title: "แผนปฏิบัติการป้องกันการทุจริต ปีงบประมาณ พ.ศ. 2569",
    open: true,
    documents: [
      {
        title: "o23 แผนปฏิบัติการป้องกันการทุจริต ปี 2569",
        description: "เอกสารรายงานประเมินคุณธรรมฯ รูปแบบ PDF",
        coverImage: null,
        coverAlt: "",
        previewHref:
          "/wp-content/uploads/morality-report-evaluation/anti-corruption-plan-2569-01-o23-แผนปฏิบัติการป้องกันการทุจริต-ปี-2569.pdf",
        downloadHref:
          "/wp-content/uploads/morality-report-evaluation/anti-corruption-plan-2569-01-o23-แผนปฏิบัติการป้องกันการทุจริต-ปี-2569.pdf",
        hasUsableTarget: true,
      },
    ],
  },
  {
    title: "นำผลประเมิน ITA ไปสู่การพัฒนาองค์กร",
    open: true,
    documents: [
      {
        title: "นำผลการประเมิน ITA ไปสู่การพัมนาองค์กร.",
        description: "เอกสารรายงานประเมินคุณธรรมฯ รูปแบบ PDF",
        coverImage: null,
        coverAlt: "",
        previewHref:
          "/wp-content/uploads/morality-report-evaluation/ita-development-results-01-นำผลการประเมิน-ITA-ไปสู่การพัมนาองค์กร..pdf",
        downloadHref:
          "/wp-content/uploads/morality-report-evaluation/ita-development-results-01-นำผลการประเมิน-ITA-ไปสู่การพัมนาองค์กร..pdf",
        hasUsableTarget: true,
      },
    ],
  },
  {
    title: "รายงานประเมินคุณธรรมและความโปร่งใส ปี 68",
    open: true,
    documents: [
      {
        title: "รายงานผลการดำเนินการเพื่อส่งเสริมคุณธรรมฯ",
        description: "เอกสารรายงานประเมินคุณธรรมฯ รูปแบบ PDF",
        coverImage: null,
        coverAlt: "",
        previewHref:
          "/wp-content/uploads/morality-report-evaluation/integrity-transparency-2568-01-รายงานผลการดำเนินการเพื่อส่งเสริมคุณธรรมฯ.pdf",
        downloadHref:
          "/wp-content/uploads/morality-report-evaluation/integrity-transparency-2568-01-รายงานผลการดำเนินการเพื่อส่งเสริมคุณธรรมฯ.pdf",
        hasUsableTarget: true,
      },
    ],
  },
];

export function isMoralityReportPath(path: string): boolean {
  return normalizeRoutePath(path).normalize("NFC") === moralityReportPath;
}

export function getMoralityReportPage(path: string) {
  if (!isMoralityReportPath(path)) return null;
  return {
    slug: "morality-report",
    path: moralityReportPath,
    title: moralityReportTitle,
    groups: moralityReportGroups,
  };
}
