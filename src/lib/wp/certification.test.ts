import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyCertificationNavOverride, certificationPages } from "./certification";

describe("certification pages", () => {
  it("keeps the dropdown idempotent", () => {
    const once = applyCertificationNavOverride([], "th", "/หน่วยรับรอง/นโยบาย");
    expect(applyCertificationNavOverride(once, "th", "/หน่วยรับรอง/นโยบาย")).toEqual(
      once,
    );
    expect(once[0].children).toHaveLength(4);
  });

  it("provides a real Test page for each certification link without inventing a registry", () => {
    const source = readFileSync("src/app/หน่วยรับรอง/[topic]/page.tsx", "utf8");
    expect(source).toContain("certificationPages.find");
    expect(source).toContain("notFound()");
    expect(source).toContain("อยู่ระหว่างจัดเตรียมข้อมูล");
    expect(certificationPages).toHaveLength(4);
  });
});
