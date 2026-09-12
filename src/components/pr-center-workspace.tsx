"use client";

import { useEffect, useState, type FormEvent } from "react";
import styles from "./pr-center-workspace.module.css";

type SessionState = "loading" | "sign-in-required" | "authenticated" | "unavailable";

const navigation = [
  "Home",
  "Submit Request",
  "My Requests",
  "All Requests",
  "Content Operations",
  "Calendar",
  "Approval Queue",
  "Notifications",
  "History",
];

export function PrCenterWorkspace() {
  const [sessionState, setSessionState] = useState<SessionState>("loading");
  const [email, setEmail] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/pr-center/session", { credentials: "same-origin" })
      .then((response) => {
        if (response.ok) setSessionState("authenticated");
        else
          setSessionState(response.status === 401 ? "sign-in-required" : "unavailable");
      })
      .catch(() => setSessionState("unavailable"));
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setLoginError(null);
    try {
      const response = await fetch("/api/pr-center/session/email", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setLoginError(payload?.message || "ไม่สามารถเข้าสู่ระบบได้");
        return;
      }
      setSessionState("authenticated");
    } catch {
      setLoginError("ไม่สามารถเชื่อมต่อระบบ PR Center ได้");
    } finally {
      setSubmitting(false);
    }
  }

  const message =
    sessionState === "loading"
      ? "กำลังตรวจสอบ session..."
      : sessionState === "sign-in-required"
        ? "กรอก email ที่ได้รับอนุญาตเพื่อเข้าใช้งาน PR Center บน Test"
        : sessionState === "authenticated"
          ? "เข้าสู่ระบบแล้วในฐานะ Scoped Administrator"
          : "PR Center กำลังรอการตั้งค่า Entra SSO และ API สำหรับสภาพแวดล้อมนี้";

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar} aria-label="PR Center navigation">
        <p className={styles.brand}>RTRDA PR CENTER</p>
        <nav>
          {navigation.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </nav>
      </aside>
      <section className={styles.content} aria-busy={sessionState === "loading"}>
        <p className={styles.eyebrow}>INTERNAL WORKSPACE</p>
        <h1>PR Center</h1>
        <p className={styles.lead}>{message}</p>
        {sessionState === "sign-in-required" && (
          <form className={styles.loginForm} onSubmit={signIn}>
            <label htmlFor="pr-center-email">Email</label>
            <div className={styles.loginRow}>
              <input
                id="pr-center-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@rtrda.or.th"
                required
              />
              <button type="submit" disabled={submitting}>
                {submitting ? "กำลังตรวจสอบ" : "เข้าสู่ระบบ"}
              </button>
            </div>
            {loginError && <p className={styles.loginError}>{loginError}</p>}
          </form>
        )}
        <section className={styles.security}>
          <h2>Secure workflow controls</h2>
          <ul>
            <li>Server-side organization and department scope</li>
            <li>Immutable revisions, approvals, audit events and outbox records</li>
            <li>Private attachments only after authorization and malware scan</li>
          </ul>
        </section>
        <p className={styles.note}>
          Test-only temporary email access. This will be replaced by Entra OIDC. Demo
          roles, browser import/export and localStorage are not used by this workspace.
        </p>
      </section>
    </main>
  );
}
