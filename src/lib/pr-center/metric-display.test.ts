import { describe, expect, it } from "vitest";
import { unavailableMetricDisplay } from "./metric-display";

describe("unavailableMetricDisplay", () => {
  it("does not substitute synthetic values for unavailable English metrics", () => {
    expect(unavailableMetricDisplay("en")).toEqual({
      value: "—",
      trend: "No verified metric data source yet",
    });
  });

  it("shows an explicit Thai provenance status", () => {
    expect(unavailableMetricDisplay("th")).toEqual({
      value: "—",
      trend: "ยังไม่มีข้อมูลตัวชี้วัดที่ยืนยันแหล่งที่มา",
    });
  });
});
