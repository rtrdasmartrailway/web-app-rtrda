"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { FieldDef } from "@/lib/content-config";
import type { ActionState } from "@/app/rtrdaintranet/manage/actions";

type Attachment = { name: string; path: string; mimeType: string };

type Props = {
  resource: string;
  fields: FieldDef[];
  hasFeaturedImage: boolean;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initialValues?: Record<string, string>;
  initialFeaturedImageId?: number | null;
  initialFeaturedImagePath?: string | null;
  initialAttachments?: Attachment[];
  submitLabel: string;
};

async function uploadFile(file: File): Promise<{
  id: number;
  filePath: string;
  mimeType: string;
  filename: string;
}> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "อัปโหลดไม่สำเร็จ (upload failed)");
  }
  return res.json();
}

function MediaUploader({
  initialId,
  initialPath,
}: {
  initialId?: number | null;
  initialPath?: string | null;
}) {
  const [id, setId] = useState<string>(initialId ? String(initialId) : "");
  const [path, setPath] = useState<string>(initialPath ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const data = await uploadFile(file);
      setId(String(data.id));
      setPath(data.filePath);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="manage-field">
      <label className="manage-label">รูปภาพหลัก (Featured image)</label>
      <input type="hidden" name="featuredImageId" value={id} />
      {path && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={path} alt="" className="manage-image-preview" />
      )}
      <input type="file" accept="image/*" onChange={onChange} disabled={busy} />
      {busy && <span className="manage-hint">กำลังอัปโหลด…</span>}
      {path && (
        <button
          type="button"
          className="manage-btn manage-btn-ghost"
          onClick={() => {
            setId("");
            setPath("");
          }}
        >
          ลบรูป
        </button>
      )}
      {err && <p className="manage-error">{err}</p>}
    </div>
  );
}

function AttachmentUploader({ initial }: { initial?: Attachment[] }) {
  const [items, setItems] = useState<Attachment[]>(initial ?? []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    setErr("");
    try {
      const uploaded: Attachment[] = [];
      for (const file of files) {
        const data = await uploadFile(file);
        uploaded.push({ name: data.filename, path: data.filePath, mimeType: data.mimeType });
      }
      setItems((prev) => [...prev, ...uploaded]);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="manage-field">
      <label className="manage-label">ไฟล์แนบ (Attachments)</label>
      <input type="hidden" name="attachments" value={JSON.stringify(items)} />
      {items.length > 0 && (
        <ul className="manage-attach-list">
          {items.map((a, i) => (
            <li key={`${a.path}-${i}`}>
              <a href={a.path} target="_blank" rel="noopener noreferrer">
                {a.name}
              </a>
              <button
                type="button"
                className="manage-btn manage-btn-ghost"
                onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
              >
                ลบ
              </button>
            </li>
          ))}
        </ul>
      )}
      <input type="file" multiple onChange={onChange} disabled={busy} />
      {busy && <span className="manage-hint">กำลังอัปโหลด…</span>}
      {err && <p className="manage-error">{err}</p>}
    </div>
  );
}

const LANGS = [
  { code: "th", suffix: "Th", label: "ไทย (Thai)" },
  { code: "en", suffix: "En", label: "English" },
] as const;

/** Render one form field. `name` is the submitted input name (may carry a Th/En suffix). */
function Field({
  field,
  name,
  value,
  error,
}: {
  field: FieldDef;
  name: string;
  value: string;
  error?: string;
}) {
  return (
    <div className="manage-field">
      <label className="manage-label" htmlFor={name}>
        {field.label}
        {field.required && <span className="manage-req"> *</span>}
      </label>

      {field.type === "textarea" ? (
        <textarea
          id={name}
          name={name}
          rows={field.rows ?? 4}
          defaultValue={value}
          className="manage-input"
        />
      ) : field.type === "datetime" ? (
        <input
          id={name}
          name={name}
          type="datetime-local"
          defaultValue={value}
          className="manage-input"
        />
      ) : (
        <>
          <input
            id={name}
            name={name}
            type="text"
            defaultValue={value}
            list={field.suggestions ? `${name}-suggestions` : undefined}
            className="manage-input"
          />
          {field.suggestions && (
            <datalist id={`${name}-suggestions`}>
              {field.suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}
        </>
      )}
      {error && <p className="manage-error">{error}</p>}
    </div>
  );
}

export function ContentForm({
  resource,
  fields,
  hasFeaturedImage,
  action,
  initialValues = {},
  initialFeaturedImageId,
  initialFeaturedImagePath,
  initialAttachments,
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);
  const [lang, setLang] = useState<"th" | "en">("th");

  const localized = fields.filter((f) => f.localized);
  const shared = fields.filter((f) => !f.localized);

  // Surface which language tab still has validation errors after a failed save.
  const tabHasError = (suffix: string) =>
    localized.some((f) => state.fieldErrors?.[`${f.name}${suffix}`]);

  return (
    <form action={formAction} className="manage-form">
      {state.error && <p className="manage-error manage-error-banner">{state.error}</p>}

      {localized.length > 0 && (
        <div className="manage-lang">
          <div className="manage-lang-tabs" role="tablist">
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                role="tab"
                aria-selected={lang === l.code}
                className={`manage-tab${lang === l.code ? " is-active" : ""}`}
                onClick={() => setLang(l.code)}
              >
                {l.label}
                {tabHasError(l.suffix) && <span className="manage-tab-dot" aria-hidden> ●</span>}
              </button>
            ))}
          </div>

          {LANGS.map((l) => (
            // Both panels stay mounted so every language submits; inactive one is hidden.
            <div key={l.code} role="tabpanel" hidden={lang !== l.code} className="manage-lang-panel">
              {localized.map((field) => {
                const name = `${field.name}${l.suffix}`;
                return (
                  <Field
                    key={name}
                    field={field}
                    name={name}
                    value={initialValues[name] ?? ""}
                    error={state.fieldErrors?.[name]}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}

      {shared.map((field) => (
        <Field
          key={field.name}
          field={field}
          name={field.name}
          value={initialValues[field.name] ?? ""}
          error={state.fieldErrors?.[field.name]}
        />
      ))}

      {hasFeaturedImage && (
        <MediaUploader
          initialId={initialFeaturedImageId}
          initialPath={initialFeaturedImagePath}
        />
      )}
      <AttachmentUploader initial={initialAttachments} />

      <div className="manage-form-actions">
        <button type="submit" className="manage-btn manage-btn-primary" disabled={pending}>
          {pending ? "กำลังบันทึก…" : submitLabel}
        </button>
        <Link href={`/rtrdaintranet/manage/${resource}`} className="manage-btn manage-btn-ghost">
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}
