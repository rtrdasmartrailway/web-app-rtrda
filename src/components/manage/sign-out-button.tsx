"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    await signOut();
    router.replace("/rtrdaintranet/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      className="manage-btn manage-btn-ghost"
      onClick={handleClick}
      disabled={busy}
    >
      {busy ? "กำลังออก…" : "ออกจากระบบ"}
    </button>
  );
}
