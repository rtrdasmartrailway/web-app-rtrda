import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/home/home-sections.tsx"),
  "utf8",
);

describe("home survey QR section", () => {
  it("is not rendered on the home page", () => {
    expect(source).not.toContain("home-survey-qr");
    expect(source).not.toContain("mot-5440");
  });
});
