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
        coverImage:
          "/wp-content/uploads/pdf-covers/morality-report-evaluation/19cb51c7b561750a.png",
        coverAlt: "หน้าแรกของ PDF",
        previewHref:
          "/wp-content/uploads/morality-report-evaluation/budget-risk-assessment-01-การประเมินความเสี่ยงการทุจริตในหน่วยงานภาครัฐ-ประจำปีงบประมาณ-พ.ศ.-2569.pdf",
        downloadHref:
          "/wp-content/uploads/morality-report-evaluation/budget-risk-assessment-01-การประเมินความเสี่ยงการทุจริตในหน่วยงานภาครัฐ-ประจำปีงบประมาณ-พ.ศ.-2569.pdf",
        hasUsableTarget: true,
      },
      {
        title: "ประเมินความเสี่ยงด้านการทุจริตฯ ด้านการเบิกจ่ายเงินงบประมาณ",
        description: "เอกสารรายงานประเมินคุณธรรมฯ รูปแบบ PDF",
        coverImage:
          "/wp-content/uploads/pdf-covers/morality-report-evaluation/6c254808c52e64b7.png",
        coverAlt: "หน้าแรกของ PDF",
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
        coverImage:
          "/wp-content/uploads/pdf-covers/morality-report-evaluation/d14363bcb5139a2d.png",
        coverAlt: "หน้าแรกของ PDF",
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
        coverImage:
          "/wp-content/uploads/pdf-covers/morality-report-evaluation/737d1fedd73b510f.png",
        coverAlt: "หน้าแรกของ PDF",
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
        coverImage:
          "/wp-content/uploads/pdf-covers/morality-report-evaluation/3d1a0f902ca02056.png",
        coverAlt: "หน้าแรกของ PDF",
        previewHref:
          "/wp-content/uploads/morality-report-evaluation/integrity-transparency-2568-01-รายงานผลการดำเนินการเพื่อส่งเสริมคุณธรรมฯ.pdf",
        downloadHref:
          "/wp-content/uploads/morality-report-evaluation/integrity-transparency-2568-01-รายงานผลการดำเนินการเพื่อส่งเสริมคุณธรรมฯ.pdf",
        hasUsableTarget: true,
      },
    ],
  },
];

export const corruptionRiskManagementPath =
  "/เอกสารเผยแพร่/การบริหารจัดการความเสี่ยงการทุจริต";
export const corruptionRiskManagementTitle = "การบริหารจัดการความเสี่ยงการทุจริต";

const corruptionRiskReportRoundOnePath = "/เอกสารเผยแพร่/report_1_2569";
const corruptionRiskReportRoundOneTitle =
  "รายงานการประเมินความเสี่ยงการทุจริต ประจำปีงบประมาณ พ.ศ. 2569 รอบที่ 1 รายงานแผนบริหารจัดการความเสี่ยงการทุจริต";
const corruptionRiskReportRoundTwoPath = "/เอกสารเผยแพร่/report_2_2569";
const corruptionRiskReportRoundTwoTitle =
  "รายงานการประเมินความเสี่ยงการทุจริต ประจำปีงบประมาณ พ.ศ. 2569 รอบที่ 2 รายงานผลการดำเนินการตามแผนบริหารจัดการความเสี่ยงการทุจริต";

const corruptionRiskReportRoundOnePdfPath =
  "/risk-reports/corruption-risk/report-1-2569.pdf?v=20260924";
const corruptionRiskReportRoundTwoPdfPath =
  "/risk-reports/corruption-risk/report-2-2569.pdf?v=20260924";

interface MoralityReportPage {
  slug: string;
  path: string;
  title: string;
  groups: KnowledgeDocumentGroup[] | null;
  contentHtml?: string;
}

const moralityReportPages: MoralityReportPage[] = [
  {
    slug: "morality-report",
    path: moralityReportPath,
    title: moralityReportTitle,
    groups: moralityReportGroups,
  },
  {
    slug: "corruption-risk-management",
    path: corruptionRiskManagementPath,
    title: corruptionRiskManagementTitle,
    groups: [
      {
        title: corruptionRiskReportRoundOneTitle,
        open: true,
        contentHeading: "รายงานแผนบริหารจัดการความเสี่ยงการทุจริต",
        contentHeadingHref: corruptionRiskReportRoundOnePath,
        documents: [],
      },
      {
        title: corruptionRiskReportRoundTwoTitle,
        open: true,
        contentHeading: "รายงานผลการดำเนินการตามแผนบริหารจัดการความเสี่ยงการทุจริต",
        contentHeadingHref: corruptionRiskReportRoundTwoPath,
        documents: [],
      },
    ] satisfies KnowledgeDocumentGroup[],
  },
  {
    slug: "corruption-risk-report-round-one-2569",
    path: corruptionRiskReportRoundOnePath,
    title: corruptionRiskReportRoundOneTitle,
    groups: null,
    contentHtml: `<div class="standalone-pdf-page"><p><a href="${corruptionRiskReportRoundOnePdfPath}" target="_blank" rel="noreferrer">เปิด PDF ในแท็บใหม่</a></p><iframe src="${corruptionRiskReportRoundOnePdfPath}#toolbar=1&navpanes=1&view=FitH" title="${corruptionRiskReportRoundOneTitle}" loading="lazy"></iframe></div>`,
  },
  {
    slug: "corruption-risk-report-round-two-2569",
    path: corruptionRiskReportRoundTwoPath,
    title: corruptionRiskReportRoundTwoTitle,
    groups: null,
    contentHtml: `<div class="standalone-pdf-page"><p><a href="${corruptionRiskReportRoundTwoPdfPath}" target="_blank" rel="noreferrer">เปิด PDF ในแท็บใหม่</a></p><iframe src="${corruptionRiskReportRoundTwoPdfPath}#toolbar=1&navpanes=1&view=FitH" title="${corruptionRiskReportRoundTwoTitle}" loading="lazy"></iframe></div>`,
  },
];

export function isMoralityReportPath(path: string): boolean {
  const normalized = normalizeRoutePath(path).normalize("NFC");
  return moralityReportPages.some((page) => page.path === normalized);
}

export function getMoralityReportPage(path: string) {
  const normalized = normalizeRoutePath(path).normalize("NFC");
  return moralityReportPages.find((page) => page.path === normalized) ?? null;
}
