"use client";

import { useRef, useState } from "react";

export function PrCenterAuditExport({ language }: { language: "th" | "en" }) {
  const thai = language === "th";
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  const download = async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setNotice("");
    setFailed(false);
    try {
      const response = await fetch("/api/pr-center/audit/export", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || "Audit export failed");
      if (!Array.isArray(result?.events) || result.count !== result.events.length)
        throw new Error("Audit export response is incomplete");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }),
      );
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = "rtrda-pr-center-audit.json";
        link.click();
      } finally {
        URL.revokeObjectURL(url);
      }
      setNotice(
        thai ? `ส่งออก ${result.count} รายการแล้ว` : `Exported ${result.count} events.`,
      );
    } catch (failure) {
      setFailed(true);
      setNotice(failure instanceof Error ? failure.message : "Audit export failed");
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <button type="button" disabled={pending} onClick={() => void download()}>
        {pending
          ? thai
            ? "กำลังส่งออก…"
            : "Exporting…"
          : thai
            ? "ส่งออก Audit"
            : "Export audit"}
      </button>
      <small>
        {thai
          ? "ข้อมูลจาก server เฉพาะองค์กรของคุณ สูงสุด 5,000 รายการล่าสุด การส่งออกถูกบันทึกใน audit trail"
          : "Server records for your organization, up to the latest 5,000 events. Each export is audited."}
      </small>
      {notice && <p role={failed ? "alert" : "status"}>{notice}</p>}
    </div>
  );
}
