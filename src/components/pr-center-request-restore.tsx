"use client";

import { useId, useRef, useState } from "react";
import { canRestoreRequestInUi } from "@/lib/pr-center/request-restore-access";
import { PrCenterDialog } from "./pr-center-dialog";

export function PrCenterRequestRestore({
  request,
  grants,
  language,
  onRestored,
}: {
  request: {
    id: string;
    title: string;
    departmentId?: string;
    status?: string;
    version?: number;
  };
  grants: readonly { role: string; departmentId: string | null }[];
  language: "th" | "en";
  onRestored: () => Promise<void>;
}) {
  const thai = language === "th";
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const busy = useRef(false);
  const eligible = canRestoreRequestInUi(grants, request);
  const restore = async () => {
    if (!eligible || busy.current || success) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/pr-center/requests/${encodeURIComponent(request.id)}/restore`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "If-Match": String(request.version),
          },
          body: JSON.stringify({ reason: reason.trim() || undefined }),
        },
      );
      const result = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          result?.message ||
            (thai ? "กู้คืนคำขอไม่สำเร็จ" : "Request could not be restored."),
        );
      setOpen(false);
      setSuccess(
        thai
          ? "กู้คืนเป็นฉบับร่างแล้ว เจ้าของคำขอต้องตรวจสอบและส่งเข้าคิวอนุมัติอีกครั้ง"
          : "Restored to draft. The requester must review and submit it for approval again.",
      );
      try {
        await onRestored();
      } catch {
        setSuccess(
          thai
            ? "กู้คืนแล้ว แต่โหลดรายการใหม่ไม่สำเร็จ กรุณารีเฟรชโดยไม่ต้องกู้คืนซ้ำ"
            : "Restored, but the list could not refresh. Refresh the list; do not restore again.",
        );
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : thai
            ? "กู้คืนคำขอไม่สำเร็จ"
            : "Request could not be restored.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  if (!eligible && !success) return null;
  return (
    <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
      {success ? (
        <p role="status">{success}</p>
      ) : (
        <button
          type="button"
          onClick={() => {
            setError("");
            setOpen(true);
          }}
        >
          {thai ? "กู้คืนคำขอ" : "Restore request"}
        </button>
      )}
      {open && (
        <PrCenterDialog
          title={thai ? "กู้คืนคำขอเป็นฉบับร่าง" : "Restore request to draft"}
          closeLabel={thai ? "ปิดหน้ากู้คืนคำขอ" : "Close request restoration"}
          language={language}
          onClose={() => {
            if (!busy.current) setOpen(false);
          }}
        >
          <form
            style={{ display: "grid", gap: 12 }}
            onSubmit={(event) => {
              event.preventDefault();
              void restore();
            }}
          >
            <p>{request.title}</p>
            <p>
              {thai
                ? "กู้คืนเฉพาะคำขอที่ถอนหรือยกเลิก ไม่ใช่การอนุมัติ เจ้าของคำขอต้องตรวจสอบและส่งใหม่ตามขั้นตอนเดิม"
                : "Only withdrawn or cancelled requests can be restored. This does not approve the request; its requester must review and resubmit through the normal workflow."}
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              <label htmlFor={reasonId}>
                {thai ? "เหตุผลการกู้คืน (ไม่บังคับ)" : "Restoration reason (optional)"}
              </label>
              <textarea
                id={reasonId}
                value={reason}
                maxLength={2000}
                disabled={pending}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
            {error && <p role="alert">{error}</p>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="submit" disabled={pending || !eligible}>
                {pending
                  ? thai
                    ? "กำลังกู้คืน…"
                    : "Restoring…"
                  : thai
                    ? "ยืนยันกู้คืนคำขอ"
                    : "Confirm restore request"}
              </button>
              <button type="button" disabled={pending} onClick={() => setOpen(false)}>
                {thai ? "ยกเลิก" : "Cancel"}
              </button>
            </div>
          </form>
        </PrCenterDialog>
      )}
    </div>
  );
}
