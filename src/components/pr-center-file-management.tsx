"use client";

import { useEffect, useRef, useState } from "react";
import { PrCenterDialog } from "./pr-center-dialog";
import styles from "./pr-center-app.module.css";
import fileStyles from "./pr-center-file-management.module.css";

type Target = { id: string; label: string; kind: "request" | "task" };
type FileRow = {
  id: string;
  fileName: string;
  scanStatus: string;
  deletedAt?: string | null;
};
type Attachment = { id: string; kind: string; file: FileRow };

async function checked(response: Response) {
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(result?.message || "The file operation failed. Please retry.");
  return result;
}

export function PrCenterFileManagement({
  language,
  targets,
  onChanged,
}: {
  language: "th" | "en";
  targets: Target[];
  onChanged: () => void;
}) {
  const thai = language === "th";
  const [selected, setSelected] = useState("");
  const target = targets.find((item) => `${item.kind}:${item.id}` === selected);
  return (
    <article className={`${styles.card} ${fileStyles.management}`}>
      <h2>{thai ? "จัดการไฟล์ในขอบเขตสิทธิ์" : "Scoped file management"}</h2>
      <p>
        {thai
          ? "สแกนไฟล์ที่ถูกกักกันซ้ำ หรือลบโดยระบุเหตุผล ไม่สามารถข้ามผลตรวจไวรัสได้"
          : "Rescan quarantined files or delete with a reason. Malware scan results cannot be overridden."}
      </p>
      <Quarantine language={language} onChanged={onChanged} />
      <h3>{thai ? "ไฟล์แนบคำขอและงาน" : "Request and task attachments"}</h3>
      <label>
        {thai ? "เลือกคำขอหรืองาน" : "Choose request or task"}
        <select
          aria-label={thai ? "เลือกคำขอหรืองาน" : "Choose request or task"}
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value="">
            {thai ? "เลือกเพื่อโหลดไฟล์แนบ" : "Select to load attachments"}
          </option>
          {targets.map((item) => (
            <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>
              {item.kind === "request" ? "Request" : "Task"}: {item.label}
            </option>
          ))}
        </select>
      </label>
      {target && (
        <AttachmentList
          key={selected}
          target={target}
          language={language}
          onChanged={onChanged}
        />
      )}
    </article>
  );
}

function Quarantine({
  language,
  onChanged,
}: {
  language: "th" | "en";
  onChanged: () => void;
}) {
  const thai = language === "th";
  const [files, setFiles] = useState<FileRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [deletion, setDeletion] = useState<FileRow | null>(null);
  const [reason, setReason] = useState("");
  const refresh = () => {
    setLoading(true);
    setOffset(0);
    setError("");
    setReload((value) => value + 1);
  };
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/pr-center/admin/quarantine?take=100&offset=${offset}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(checked)
      .then((rows: FileRow[]) => {
        if (!controller.signal.aborted) {
          setFiles((previous) =>
            offset === 0
              ? rows
              : [
                  ...previous,
                  ...rows.filter((row) => !previous.some((item) => item.id === row.id)),
                ],
          );
          setHasMore(rows.length === 100);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            thai
              ? "โหลดรายการไฟล์กักกันไม่สำเร็จ กรุณาลองใหม่"
              : "Could not load quarantined files. Please retry.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reload, thai, offset]);
  const mutate = async (file: FileRow, remove: boolean) => {
    if (lock.current || (remove && !reason.trim())) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await checked(
        await fetch(
          `/api/pr-center/admin/quarantine/${encodeURIComponent(file.id)}/${remove ? "review" : "rescan"}`,
          {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              remove ? { disposition: "delete", reason: reason.trim() } : {},
            ),
          },
        ),
      );
      setNotice(
        remove
          ? thai
            ? "ลบไฟล์แล้ว"
            : "File deleted"
          : `${thai ? "ผลสแกน" : "Scan result"}: ${result.scanStatus}`,
      );
      setDeletion(null);
      setReason("");
      refresh();
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "File operation failed");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <section aria-label={thai ? "ไฟล์กักกัน" : "Quarantined files"}>
      <h3>{thai ? "ไฟล์กักกัน" : "Quarantined files"}</h3>
      <button type="button" onClick={refresh} disabled={loading || busy}>
        {thai ? "รีเฟรชไฟล์กักกัน" : "Refresh quarantined files"}
      </button>
      <p>
        {thai
          ? "แสดงไฟล์ใน scope ของคุณ หน้าละ 100 รายการ ใช้โหลดเพิ่มเพื่อดูไฟล์ก่อนหน้า"
          : "Files within your scope, 100 per page. Load more to see older files."}
      </p>
      {loading ? (
        <p role="status">{thai ? "กำลังโหลด…" : "Loading…"}</p>
      ) : files.length === 0 && !error ? (
        <p>{thai ? "ไม่มีไฟล์กักกัน" : "No quarantined files"}</p>
      ) : (
        <ul>
          {files.map((file) => (
            <li key={file.id}>
              <strong>{file.fileName}</strong> · {file.scanStatus}{" "}
              <button
                type="button"
                disabled={busy || loading}
                onClick={() => void mutate(file, false)}
              >
                {thai ? "สแกนซ้ำ" : "Rescan"}
              </button>{" "}
              <button
                type="button"
                disabled={busy || loading}
                onClick={() => {
                  setDeletion(file);
                  setReason("");
                  setError("");
                }}
              >
                {thai ? "ลบไฟล์กักกัน" : "Delete quarantined file"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {hasMore && !error && (
        <button
          type="button"
          disabled={loading || busy}
          onClick={() => {
            setLoading(true);
            setOffset((value) => value + 100);
          }}
        >
          {thai ? "โหลดไฟล์กักกันเพิ่ม" : "Load more quarantined files"}
        </button>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {deletion && (
        <PrCenterDialog
          title={thai ? "ยืนยันลบไฟล์กักกัน" : "Confirm quarantine deletion"}
          language={language}
          onClose={() => {
            if (!lock.current) setDeletion(null);
          }}
        >
          <p>{deletion.fileName}</p>
          <label className={fileStyles.reason}>
            {thai ? "เหตุผลในการลบ (จำเป็น)" : "Deletion reason (required)"}
            <textarea
              required
              maxLength={1000}
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button
            type="button"
            disabled={busy || !reason.trim()}
            onClick={() => void mutate(deletion, true)}
          >
            {busy
              ? thai
                ? "กำลังลบ…"
                : "Deleting…"
              : thai
                ? "ยืนยันลบไฟล์"
                : "Confirm delete file"}
          </button>
        </PrCenterDialog>
      )}
    </section>
  );
}

function AttachmentList({
  language,
  target,
  onChanged,
}: {
  language: "th" | "en";
  target: Target;
  onChanged: () => void;
}) {
  const thai = language === "th";
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deletion, setDeletion] = useState<Attachment | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const refresh = () => {
    setLoading(true);
    setError("");
    setReload((value) => value + 1);
  };
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      [target.kind === "request" ? "requestId" : "taskId"]: target.id,
    });
    fetch(`/api/pr-center/attachments?${params}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(checked)
      .then((rows: Attachment[]) => {
        if (!controller.signal.aborted) setItems(rows);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            thai
              ? "โหลดไฟล์แนบไม่สำเร็จ กรุณาลองใหม่"
              : "Could not load attachments. Please retry.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [target.id, target.kind, reload, thai]);
  const remove = async () => {
    if (!deletion || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await checked(
        await fetch(`/api/pr-center/attachments/${encodeURIComponent(deletion.id)}`, {
          method: "DELETE",
          credentials: "same-origin",
        }),
      );
      setDeletion(null);
      setNotice(thai ? "นำไฟล์แนบออกแล้ว" : "Attachment removed");
      refresh();
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove attachment");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <section aria-label={thai ? "รายการไฟล์แนบ" : "Attachment list"}>
      <button type="button" onClick={refresh} disabled={loading || busy}>
        {thai ? "รีเฟรชไฟล์แนบ" : "Refresh attachments"}
      </button>
      {loading ? (
        <p role="status">{thai ? "กำลังโหลด…" : "Loading…"}</p>
      ) : !items.length && !error ? (
        <p>{thai ? "ไม่มีไฟล์แนบ" : "No attachments"}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              {item.file.fileName} · {item.file.scanStatus}{" "}
              {item.file.scanStatus === "CLEAN" && !item.file.deletedAt && (
                <a
                  href={`/api/pr-center/files/${encodeURIComponent(item.file.id)}/download`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {thai ? "ดาวน์โหลด" : "Download"}
                </a>
              )}{" "}
              <button
                type="button"
                disabled={busy || loading}
                onClick={() => {
                  setDeletion(item);
                  setError("");
                }}
              >
                {thai ? "นำไฟล์แนบออก" : "Remove attachment"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {deletion && (
        <PrCenterDialog
          title={thai ? "ยืนยันนำไฟล์แนบออก" : "Confirm attachment removal"}
          language={language}
          onClose={() => {
            if (!lock.current) setDeletion(null);
          }}
        >
          <p>{deletion.file.fileName}</p>
          <p>
            {thai
              ? "นำลิงก์ไฟล์นี้ออกจากรายการที่เลือกเท่านั้น"
              : "Remove this attachment link from the selected record."}
          </p>
          {error && <p role="alert">{error}</p>}
          <button type="button" disabled={busy} onClick={() => void remove()}>
            {busy
              ? thai
                ? "กำลังนำออก…"
                : "Removing…"
              : thai
                ? "ยืนยันนำไฟล์แนบออก"
                : "Confirm remove attachment"}
          </button>
        </PrCenterDialog>
      )}
    </section>
  );
}
