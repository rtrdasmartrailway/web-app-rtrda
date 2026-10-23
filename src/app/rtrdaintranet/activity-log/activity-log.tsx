"use client";
import { useEffect, useState } from "react";
import { ACTIVITY_TYPES } from "@/lib/analytics/activity-contract";

type Row = {
  occurred_at: string;
  event_type: string;
  channel: string;
  path: string;
  target_path: string | null;
  method: string | null;
  status: number | null;
  outcome: string;
  response_bytes: string | null;
  is_bot: boolean;
  session_key: string | null;
};
type Report = {
  rows: Row[];
  summary: { events: number; sessions: number; ip_days: number; bot_events: number };
  types: { event_type: string; count: number }[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  window: { from: string; until: string };
};
const names: Record<string, string> = {
  page_request: "คำขอหน้าเว็บ",
  page_view: "เปิดหน้าด้วยเบราว์เซอร์",
  link_click: "คลิกลิงก์",
  download_click: "คลิกดาวน์โหลด",
  download_response: "การตอบกลับไฟล์",
  redirect_response: "ส่งต่อแบบฟอร์ม",
};
const time = (value: string) =>
  new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
export default function ActivityLog() {
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    path: "",
    type: "",
    bots: "all",
  });
  const [query, setQuery] = useState("page=1");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/analytics/reports?${query}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            response.status === 401
              ? "กรุณาเข้าสู่ระบบ PR Center อีกครั้ง"
              : response.status === 403
                ? "บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบส่วนกลาง"
                : "ยังไม่สามารถโหลดบันทึกได้ กรุณาลองใหม่",
          );
        setReport(await response.json());
      })
      .catch((reason) => {
        if (reason.name !== "AbortError") setError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, revision]);
  function apply() {
    setLoading(true);
    setError("");
    setRevision((value) => value + 1);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    params.set("page", "1");
    setQuery(params.toString());
  }
  function page(value: number) {
    setLoading(true);
    setError("");
    setRevision((value) => value + 1);
    const params = new URLSearchParams(query);
    params.set("page", String(value));
    setQuery(params.toString());
  }
  const exportParams = new URLSearchParams(query);
  exportParams.set("format", "csv");
  exportParams.set("page", "1");
  return (
    <section className="activity-log">
      <div className="activity-heading">
        <div>
          <span className="activity-badge">TEST · เฉพาะผู้ดูแลระบบ</span>
          <h1>บันทึกการใช้งานเว็บไซต์</h1>
          <p>หลักฐานการเข้าถึงและการตอบกลับไฟล์ · เก็บย้อนหลัง 3 เดือนปฏิทิน · เวลาไทย</p>
        </div>
        <a
          className="activity-button secondary"
          href={`/api/analytics/reports?${exportParams}`}
        >
          ส่งออก CSV (สูงสุด 5,000 แถว)
        </a>
      </div>
      <div className="activity-notice">
        จำนวนคำขอ การเปิดหน้า คลิกดาวน์โหลด และการตอบกลับไฟล์เป็นคนละเหตุการณ์
        จึงไม่ควรนำมารวมเป็นจำนวนคนหรือจำนวนดาวน์โหลดสำเร็จ การตอบกลับไฟล์ 200/206
        ไม่ยืนยันว่าผู้ใช้รับไฟล์ครบแล้ว เริ่มเก็บข้อมูลหลังเปิดใช้งานเท่านั้น
      </div>
      <form
        className="activity-filters"
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
      >
        <label>
          ตั้งแต่ (เวลาไทย)
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
        </label>
        <label>
          ถึง (รวมวันนี้)
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </label>
        <label className="activity-path">
          เส้นทางหน้าเว็บ / ไฟล์
          <input
            value={filters.path}
            placeholder="/เกี่ยวกับ-สทร"
            onChange={(e) => setFilters({ ...filters, path: e.target.value })}
          />
        </label>
        <label>
          เหตุการณ์
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          >
            <option value="">ทั้งหมด</option>
            {ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {names[type]}
              </option>
            ))}
          </select>
        </label>
        <label>
          บอต
          <select
            value={filters.bots}
            onChange={(e) => setFilters({ ...filters, bots: e.target.value })}
          >
            <option value="all">รวมทั้งหมด</option>
            <option value="exclude">ไม่รวมบอตที่ตรวจพบ</option>
            <option value="only">เฉพาะบอตที่ตรวจพบ</option>
          </select>
        </label>
        <button className="activity-button" disabled={loading}>
          ดูบันทึก
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      <div className="activity-stats">
        {[
          ["เหตุการณ์ทั้งหมด", report?.summary.events],
          ["เซสชันนามแฝง", report?.summary.sessions],
          ["กลุ่ม IP ต่อวัน", report?.summary.ip_days],
          ["เหตุการณ์บอต", report?.summary.bot_events],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <span>{label}</span>
            <strong>
              {typeof value === "number" ? value.toLocaleString("th-TH") : "—"}
            </strong>
          </div>
        ))}
      </div>
      <p className="activity-caption">
        เซสชันหมดอายุเมื่อไม่มีกิจกรรม 30 นาที · กลุ่ม IP เปลี่ยนนามแฝงทุกวัน
        ไม่ใช่จำนวนบุคคล · ไม่เก็บ IP จริง ข้อความในแบบฟอร์ม หรือพารามิเตอร์ URL
      </p>
      <div className="activity-types">
        {report?.types.map((type) => (
          <span key={type.event_type}>
            {names[type.event_type]} <b>{type.count.toLocaleString("th-TH")}</b>
          </span>
        ))}
      </div>
      <div className="activity-table-wrap" aria-busy={loading}>
        <table>
          <thead>
            <tr>
              <th>วันเวลา (ไทย)</th>
              <th>เหตุการณ์</th>
              <th>หน้าเว็บ / ไฟล์</th>
              <th>HTTP</th>
              <th>ผลที่สังเกตได้</th>
              <th>บอต</th>
            </tr>
          </thead>
          <tbody>
            {report?.rows.map((row, index) => (
              <tr key={`${row.occurred_at}-${index}`}>
                <td>{time(row.occurred_at)}</td>
                <td>
                  {names[row.event_type]}
                  <small>{row.channel}</small>
                </td>
                <td className="activity-route">
                  {row.path}
                  {row.target_path && row.target_path !== row.path && (
                    <small>→ {row.target_path}</small>
                  )}
                </td>
                <td>
                  {row.method || "—"} {row.status ?? "—"}
                </td>
                <td>
                  <small>{row.outcome}</small>
                  {row.response_bytes && (
                    <small>
                      {Number(row.response_bytes).toLocaleString()} bytes ที่เตรียมตอบกลับ
                    </small>
                  )}
                </td>
                <td>{row.is_bot ? "ตรวจพบ" : "ไม่พบชัดเจน"}</td>
              </tr>
            ))}
            {report?.rows.length === 0 && (
              <tr>
                <td colSpan={6}>ยังไม่มีเหตุการณ์ตรงกับตัวกรองนี้</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="activity-pagination">
        <button
          onClick={() => page((report?.page || 1) - 1)}
          disabled={loading || !report || report.page <= 1}
        >
          ก่อนหน้า
        </button>
        <span>หน้า {report?.page || 1} · ครั้งละ 50 แถว</span>
        <button
          onClick={() => page((report?.page || 1) + 1)}
          disabled={loading || !report?.hasMore}
        >
          ถัดไป
        </button>
      </div>
    </section>
  );
}
