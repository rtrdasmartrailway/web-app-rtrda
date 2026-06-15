"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth-client";

function MicrosoftLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

export function LoginButton({ redirectTo }: { redirectTo?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setBusy(true);
    setError("");
    try {
      await signIn.social({
        provider: "microsoft",
        callbackURL: redirectTo || "/rtrdaintranet/manage",
      });
    } catch {
      setBusy(false);
      setError("เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่ (sign-in failed)");
    }
  }

  return (
    <div className="login-action">
      <button
        type="button"
        className="login-ms-btn"
        onClick={handleClick}
        disabled={busy}
      >
        {busy ? (
          <span className="login-spinner" aria-hidden="true" />
        ) : (
          <MicrosoftLogo />
        )}
        <span>{busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบด้วย Microsoft"}</span>
      </button>
      {error && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
