"use client";

import { useState } from "react";

export function DeleteButton({
  action,
  label,
}: {
  action: () => Promise<void>;
  label: string;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <form
      action={async () => {
        setBusy(true);
        await action();
      }}
      onSubmit={(e) => {
        if (!confirm(`ต้องการลบ "${label}" ใช่หรือไม่?`)) e.preventDefault();
      }}
    >
      <button type="submit" className="manage-btn manage-btn-danger" disabled={busy}>
        {busy ? "กำลังลบ…" : "ลบ"}
      </button>
    </form>
  );
}
