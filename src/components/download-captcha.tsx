"use client";

import { useEffect, useEffectEvent, useState, type FormEvent } from "react";
import Script from "next/script";
import styles from "./download-captcha.module.css";

interface Challenge {
  id: string;
  question: string;
}

type ProtectedDocumentIntent = "download" | "preview";

interface ProtectedDownloadDetail {
  documentId?: string;
}

interface ProtectedPreviewDetail extends ProtectedDownloadDetail {
  previewUrl?: string;
}

declare global {
  interface Window {
    grecaptcha?: {
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
      ready: (callback: () => void) => void;
    };
  }
}

interface DownloadResponseError {
  error?: string;
  fallback?: boolean;
}

const RECAPTCHA_DOWNLOAD_ACTION = "download_document";
const RECAPTCHA_PREVIEW_ACTION = "preview_document";

export function DownloadCaptcha({ siteKey }: { siteKey: string }) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [documentId, setDocumentId] = useState("");
  const [intent, setIntent] = useState<ProtectedDocumentIntent>("download");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function saveDownload(file: Blob) {
    const href = URL.createObjectURL(file);
    const link = window.document.createElement("a");
    link.href = href;
    link.download = "rail-technology-strategy-2571-2575.pdf";
    link.click();
    URL.revokeObjectURL(href);
  }

  function completePreview(previewUrl: string, document: string) {
    window.dispatchEvent(
      new CustomEvent<ProtectedPreviewDetail>("rtrda-protected-preview", {
        detail: { documentId: document, previewUrl },
      }),
    );
  }

  async function completeRequest(
    response: Response,
    document: string,
    nextIntent: ProtectedDocumentIntent,
  ) {
    if (nextIntent === "download") {
      saveDownload(await response.blob());
      return;
    }

    const payload = (await response.json()) as { previewUrl?: string };
    if (!payload.previewUrl) throw new Error("ไม่สามารถเปิดเอกสารได้");
    completePreview(payload.previewUrl, document);
  }

  async function issueMathChallenge(
    document: string,
    nextIntent: ProtectedDocumentIntent,
  ) {
    setLoading(true);
    setError("");
    setAnswer("");
    setDocumentId(document);
    setIntent(nextIntent);
    try {
      const response = await fetch(
        `/api/download-captcha?document=${encodeURIComponent(document)}&intent=${nextIntent}`,
        {
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as Challenge & { error?: string };
      if (!response.ok || !payload.id || !payload.question) {
        throw new Error(payload.error ?? "ไม่สามารถสร้าง CAPTCHA ได้ในขณะนี้");
      }
      setChallenge(payload);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "ไม่สามารถสร้าง CAPTCHA ได้ในขณะนี้",
      );
    } finally {
      setLoading(false);
    }
  }

  async function requestWithRecaptcha(
    document: string,
    nextIntent: ProtectedDocumentIntent,
  ): Promise<boolean> {
    if (!siteKey || !window.grecaptcha) return false;

    try {
      const token = await new Promise<string>((resolve, reject) => {
        window.grecaptcha?.ready(() => {
          window.grecaptcha
            ?.execute(siteKey, {
              action:
                nextIntent === "preview"
                  ? RECAPTCHA_PREVIEW_ACTION
                  : RECAPTCHA_DOWNLOAD_ACTION,
            })
            .then(resolve, reject);
        });
      });
      const response = await fetch("/api/download-captcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: document,
          intent: nextIntent,
          recaptchaToken: token,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as DownloadResponseError;
        if (payload.fallback) return false;
        throw new Error(payload.error ?? "ไม่สามารถยืนยัน reCAPTCHA ได้");
      }
      await completeRequest(response, document, nextIntent);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถยืนยัน reCAPTCHA ได้");
      return false;
    }
  }

  async function open(document: string, nextIntent: ProtectedDocumentIntent) {
    setChallenge(null);
    setDocumentId(document);
    setIntent(nextIntent);
    setLoading(true);
    setError("");
    if (await requestWithRecaptcha(document, nextIntent)) {
      setLoading(false);
      return;
    }
    await issueMathChallenge(document, nextIntent);
  }

  const onDownload = useEffectEvent((event: Event) => {
    const detail = (event as CustomEvent<ProtectedDownloadDetail>).detail;
    if (detail?.documentId) void open(detail.documentId, "download");
  });

  const onClick = useEffectEvent((event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest<HTMLAnchorElement>(
      "a[data-protected-download], a[data-protected-preview]",
    );
    const id = link?.dataset.protectedDownload ?? link?.dataset.protectedPreview;
    const nextIntent: ProtectedDocumentIntent = link?.dataset.protectedPreview
      ? "preview"
      : "download";
    if (!link || !id || event.defaultPrevented) return;
    event.preventDefault();
    void open(id, nextIntent);
  });

  useEffect(() => {
    window.addEventListener("rtrda-protected-download", onDownload);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("rtrda-protected-download", onDownload);
      document.removeEventListener("click", onClick);
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge || !documentId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/download-captcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer, challengeId: challenge.id, documentId, intent }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "คำตอบ CAPTCHA ไม่ถูกต้อง");
      }
      await completeRequest(response, documentId, intent);
      setChallenge(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถดาวน์โหลดไฟล์ได้");
    } finally {
      setLoading(false);
    }
  }

  const recaptchaScript = siteKey ? (
    <Script
      src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`}
      strategy="afterInteractive"
    />
  ) : null;

  if (!challenge && !loading && !error) return recaptchaScript;

  return (
    <>
      {recaptchaScript}
      <div className={styles.backdrop} role="presentation">
        <section
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="captcha-title"
        >
          <button
            type="button"
            className={styles.close}
            onClick={() => {
              setChallenge(null);
              setError("");
            }}
          >
            ปิด
          </button>
          <h2 id="captcha-title">
            {intent === "preview" ? "ยืนยันก่อนเปิดเอกสาร" : "ยืนยันก่อนดาวน์โหลด"}
          </h2>
          {challenge ? (
            <form onSubmit={submit}>
              <label htmlFor="download-captcha-answer">
                กรุณาตอบ: {challenge.question}
              </label>
              <input
                id="download-captcha-answer"
                inputMode="numeric"
                onChange={(event) => setAnswer(event.target.value)}
                required
                value={answer}
              />
              <button type="submit" disabled={loading}>
                {loading
                  ? "กำลังตรวจสอบ..."
                  : intent === "preview"
                    ? "ยืนยันและเปิดเอกสาร"
                    : "ยืนยันและดาวน์โหลด"}
              </button>
            </form>
          ) : null}
          {loading && !challenge ? <p>กำลังยืนยัน reCAPTCHA...</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}
        </section>
      </div>
    </>
  );
}
