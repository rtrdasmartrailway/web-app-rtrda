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
          documents: [],
        },
        {
          title:
            "รายงานการประเมินความเสี่ยงการทุจริต ประจำปีงบประมาณ พ.ศ. 2569 รอบที่ 2 รายงานผลการดำเนินการตามแผนบริหารจัดการความเสี่ยงการทุจริต",
          documents: [],
        },
      ],
    });
  });
});
