"use client";

import { useEffect, useState } from "react";
import styles from "./pr-center-workspace.module.css";

type SessionState = "loading" | "sign-in-required" | "unavailable";

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

  useEffect(() => {
    // The BFF supplies this endpoint only after Entra OIDC is configured.
    fetch("/api/pr-center/session", { credentials: "same-origin" })
      .then((response) =>
        setSessionState(response.status === 401 ? "sign-in-required" : "unavailable"),
      )
      .catch(() => setSessionState("unavailable"));
  }, []);

  const message =
    sessionState === "loading"
      ? "กำลังตรวจสอบ session..."
      : sessionState === "sign-in-required"
        ? "กรุณาเข้าสู่ระบบด้วยบัญชีองค์กรเพื่อใช้งาน PR Center"
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
        <section className={styles.security}>
          <h2>Secure workflow controls</h2>
          <ul>
            <li>Server-side organization and department scope</li>
            <li>Immutable revisions, approvals, audit events and outbox records</li>
            <li>Private attachments only after authorization and malware scan</li>
          </ul>
        </section>
        <p className={styles.note}>
          Demo roles, browser import/export and localStorage are not used by this
          workspace.
        </p>
      </section>
    </main>
  );
}
