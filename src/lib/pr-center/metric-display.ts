export type MetricDisplay = { value: string; trend: string };

export function unavailableMetricDisplay(language: "th" | "en"): MetricDisplay {
  return {
    value: "—",
    trend:
      language === "th"
        ? "ยังไม่มีข้อมูลตัวชี้วัดที่ยืนยันแหล่งที่มา"
        : "No verified metric data source yet",
  };
}
