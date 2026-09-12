"use client";

import { useEffect, useState, type FormEvent } from "react";
import styles from "./pr-center-workspace.module.css";

type SessionState = "loading" | "sign-in-required" | "authenticated" | "unavailable";
type Page =
  | "Home"
  | "Submit Request"
  | "My Requests"
  | "All Requests"
  | "Content Operations"
  | "Calendar"
  | "Approval Queue"
  | "Notifications"
  | "History";
type RequestRow = {
  id: string;
  requestNumber: string;
  title: string;
  type: "PR" | "OFFSITE";
  status: string;
  createdAt: string;
  requester: { displayName: string };
  tasks: { id: string; status: string }[];
};

const navigation: Page[] = [
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

function requestDate(value: string) {
  return new Date(value).toLocaleDateString("th-TH-u-ca-buddhist", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function PrCenterWorkspace() {
  const [sessionState, setSessionState] = useState<SessionState>("loading");
  const [page, setPage] = useState<Page>("Home");
  const [email, setEmail] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [loadingRequests, setLoadingRequests] = useState(false);
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

  useEffect(() => {
    if (
      sessionState !== "authenticated" ||
      !["Home", "My Requests", "All Requests"].includes(page)
    )
      return;
    setLoadingRequests(true);
    setRequestsError(null);
    fetch("/api/pr-center/requests?take=25", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("ไม่สามารถโหลดคำขอได้");
        setRequests((await response.json()) as RequestRow[]);
      })
      .catch((error: unknown) =>
        setRequestsError(error instanceof Error ? error.message : "ไม่สามารถโหลดคำขอได้"),
      )
      .finally(() => setLoadingRequests(false));
  }, [page, sessionState]);

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

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setRequestsError(null);
    try {
      const response = await fetch("/api/pr-center/requests", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.get("type"),
          title: form.get("title"),
          objective: form.get("objective"),
          audience: form.get("audience"),
          requestedFor: form.get("requestedFor") || undefined,
          sourceUrls: form.get("sourceUrl") ? [form.get("sourceUrl")] : [],
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(payload?.message || "ไม่สามารถบันทึกคำขอได้");
      }
      event.currentTarget.reset();
      setPage("My Requests");
    } catch (error) {
      setRequestsError(error instanceof Error ? error.message : "ไม่สามารถบันทึกคำขอได้");
    } finally {
      setSubmitting(false);
    }
  }

  const signedIn = sessionState === "authenticated";
  const isRequestList = ["Home", "My Requests", "All Requests"].includes(page);

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar} aria-label="PR Center navigation">
        <p className={styles.brand}>RTRDA PR CENTER</p>
        <nav>
          {navigation.map((item) => (
            <button
              className={page === item ? styles.activeNav : undefined}
              key={item}
              type="button"
              onClick={() => setPage(item)}
              disabled={!signedIn}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>
      <section
        className={styles.content}
        aria-busy={sessionState === "loading" || loadingRequests}
      >
        <p className={styles.eyebrow}>INTERNAL WORKSPACE</p>
        <h1>{page}</h1>
        {sessionState === "loading" && (
          <p className={styles.lead}>กำลังตรวจสอบ session...</p>
        )}
        {sessionState === "unavailable" && (
          <p className={styles.lead}>PR Center ไม่พร้อมใช้งานในขณะนี้</p>
        )}
        {sessionState === "sign-in-required" && (
          <form className={styles.loginForm} onSubmit={signIn}>
            <p className={styles.lead}>
              กรอก email ที่ได้รับอนุญาตเพื่อเข้าใช้งาน PR Center บน Test
            </p>
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
        {signedIn && page === "Submit Request" && (
          <form className={styles.requestForm} onSubmit={submitRequest}>
            <p className={styles.lead}>สร้างคำขอ PR หรือ Off-site ใหม่</p>
            <label>
              ประเภท
              <select name="type" defaultValue="PR">
                <option value="PR">PR</option>
                <option value="OFFSITE">Off-site</option>
              </select>
            </label>
            <label>
              หัวข้อ
              <input name="title" minLength={3} maxLength={300} required />
            </label>
            <label>
              วัตถุประสงค์
              <textarea name="objective" rows={3} />
            </label>
            <label>
              กลุ่มเป้าหมาย
              <input name="audience" />
            </label>
            <label>
              วันที่ต้องการ
              <input name="requestedFor" type="date" />
            </label>
            <label>
              Source URL (HTTPS)
              <input name="sourceUrl" type="url" placeholder="https://..." />
            </label>
            <button type="submit" disabled={submitting}>
              {submitting ? "กำลังบันทึก" : "บันทึกคำขอ"}
            </button>
          </form>
        )}
        {signedIn && isRequestList && (
          <section className={styles.requests}>
            <p className={styles.lead}>
              {page === "Home"
                ? "Personal queue and recent requests"
                : "คำขอที่อยู่ใน scope ของคุณ"}
            </p>
            {requestsError && <p className={styles.loginError}>{requestsError}</p>}
            {!loadingRequests && !requestsError && requests.length === 0 && (
              <p>ยังไม่มีคำขอ เลือก Submit Request เพื่อสร้างรายการแรก</p>
            )}
            {requests.map((request) => (
              <article className={styles.requestCard} key={request.id}>
                <div>
                  <strong>{request.title}</strong>
                  <p>{request.requestNumber}</p>
                </div>
                <span>{request.status}</span>
                <small>
                  {request.type} · {request.requester.displayName} ·{" "}
                  {requestDate(request.createdAt)}
                </small>
              </article>
            ))}
          </section>
        )}
        {signedIn && !isRequestList && page !== "Submit Request" && (
          <section className={styles.security}>
            <h2>{page}</h2>
            <p>
              หน้านี้เปิดจาก sidebar แล้ว และจะเชื่อม workflow data ตาม Phase 1
              ในขั้นถัดไป
            </p>
          </section>
        )}
        <p className={styles.note}>
          Test-only temporary email access. This will be replaced by Entra OIDC. Demo
          roles, browser import/export and localStorage are not used by this workspace.
        </p>
      </section>
    </main>
  );
}
