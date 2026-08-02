import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/home/home-sections.tsx"),
  "utf8",
);

describe("HomeSatisfactionSurveyQr", () => {
  it("uses the full Ministry of Transport satisfaction survey wording", () => {
    const newTitle =
      "แบบสำรวจความพึงพอใจของหน่วยงานในสังกัดกระทรวงคมนาคม ประจำปีงบประมาณ พ.ศ. 2569";
    const oldTitle = "แบบสำรวจความพึงพอใจ ประจำปีงบประมาณ พ.ศ. 2569";

    expect(source).toContain(newTitle);
    expect(source).not.toContain(`? "${oldTitle}"`);
    expect(source).not.toContain(`? "QR Code ${oldTitle}"`);
  });
});
