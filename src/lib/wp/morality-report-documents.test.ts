import { describe, expect, it } from "vitest";
import { getMoralityReportPage } from "./morality-report-documents";

describe("getMoralityReportPage", () => {
  it("creates an empty publication landing page for corruption risk management", () => {
    const page = getMoralityReportPage(
      "/เอกสารเผยแพร่/การบริหารจัดการความเสี่ยงการทุจริต",
    );

    expect(page).toMatchObject({
      path: "/เอกสารเผยแพร่/การบริหารจัดการความเสี่ยงการทุจริต",
      title: "การบริหารจัดการความเสี่ยงการทุจริต",
      groups: [
        {
          title:
            "รายงานการประเมินความเสี่ยงการทุจริต ประจำปีงบประมาณ พ.ศ. 2569 รอบที่ 1 รายงานแผนบริหารจัดการความเสี่ยงการทุจริต",
          contentHeading: "รายงานแผนบริหารจัดการความเสี่ยงการทุจริต",
          contentHeadingHref: "/เอกสารเผยแพร่/report_1_2569",
          documents: [],
        },
        {
          title:
            "รายงานการประเมินความเสี่ยงการทุจริต ประจำปีงบประมาณ พ.ศ. 2569 รอบที่ 2 รายงานผลการดำเนินการตามแผนบริหารจัดการความเสี่ยงการทุจริต",
          contentHeading: "รายงานผลการดำเนินการตามแผนบริหารจัดการความเสี่ยงการทุจริต",
          contentHeadingHref: "/เอกสารเผยแพร่/report_2_2569",
          documents: [],
        },
      ],
    });
  });

  it.each([
    {
      path: "/เอกสารเผยแพร่/report_1_2569",
      title:
        "รายงานการประเมินความเสี่ยงการทุจริต ประจำปีงบประมาณ พ.ศ. 2569 รอบที่ 1 รายงานแผนบริหารจัดการความเสี่ยงการทุจริต",
      groups: null,
    },
    {
      path: "/เอกสารเผยแพร่/report_2_2569",
      title:
        "รายงานการประเมินความเสี่ยงการทุจริต ประจำปีงบประมาณ พ.ศ. 2569 รอบที่ 2 รายงานผลการดำเนินการตามแผนบริหารจัดการความเสี่ยงการทุจริต",
      groups: null,
    },
  ])("creates a report page at $path", ({ path, title, groups }) => {
    expect(getMoralityReportPage(path)).toMatchObject({
      path,
      title,
      groups,
    });
  });

  it("embeds the first-round PDF in its report page", () => {
    const content = getMoralityReportPage("/เอกสารเผยแพร่/report_1_2569")?.contentHtml;
    expect(content).toContain(
      "/risk-reports/corruption-risk/report-1-2569.pdf?v=20260924",
    );
    expect(content).toContain('<div class="standalone-pdf-page">');
    expect(content).toContain("<iframe");
    expect(content).toContain('data-pdf-reader-ignore="true"');
  });

  it("embeds the second-round PDF in its report page", () => {
    const content = getMoralityReportPage("/เอกสารเผยแพร่/report_2_2569")?.contentHtml;
    expect(content).toContain(
      "/risk-reports/corruption-risk/report-2-2569.pdf?v=20260924-final",
    );
    expect(content).toContain('<div class="standalone-pdf-page">');
    expect(content).toContain("<iframe");
    expect(content).toContain('data-pdf-reader-ignore="true"');
  });
});
