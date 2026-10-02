"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SurveyData } from "@/lib/survey/google-sheets";

const format = new Intl.NumberFormat("th-TH");
const clock = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

export default function SurveyDashboard() {
  const [data, setData] = useState<SurveyData | null>(null);
  const summary = data?.summary;
  const [query, setQuery] = useState("");
  const [organization, setOrganization] = useState("");
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const nameColumns = useMemo(
    () =>
      data?.headers.flatMap((header, index) =>
        index < 14 &&
        /ชื่อ|name|นามสกุล|surname/i.test(header) &&
        !/หน่วยงาน|organization|ตำแหน่ง|position/i.test(header)
          ? [index]
          : [],
      ) ?? [],
    [data],
  );
  const organizationColumn =
    data?.headers.findIndex((header) => /หน่วยงาน|องค์กร|organization/i.test(header)) ??
    -1;
  const organizationFor = (cells: string[]) =>
    cells[organizationColumn >= 0 ? organizationColumn : 5] ?? "";
  const nameFor = (cells: string[], row: number) =>
    nameColumns
      .map((index) => cells[index])
      .filter(Boolean)
      .join(" ") || `ผู้ตอบลำดับ ${row}`;
  const organizations = Array.from(
    new Set(
      data?.responses
        .map((response) => organizationFor(response.cells))
        .filter(Boolean) ?? [],
    ),
  ).sort();
  const filtered =
    data?.responses.filter(
      (response) =>
        (!organization || organizationFor(response.cells) === organization) &&
        (!query.trim() ||
          response.cells.some((cell) =>
            cell.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
          )),
    ) ?? [];
  const selected = data?.responses.find((response) => response.sheetRow === selectedRow);
  const [state, setState] = useState<"loading" | "live" | "stale">("loading");
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/survey-dashboard", {
        cache: "no-store",
        signal,
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 503) setData(null);
        throw new Error("unavailable");
      }
      const next = (await response.json()) as SurveyData;
      if (signal?.aborted) return;
      setData(next);
      setState("live");
    } catch {
      if (!signal?.aborted) setState("stale");
    } finally {
      if (!signal?.aborted) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const initial = window.setTimeout(() => void refresh(controller.signal), 0);
    const interval = window.setInterval(() => void refresh(controller.signal), 30_000);
    return () => {
      controller.abort();
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refresh]);

  return (
    <div className="survey-dashboard">
      <div className="survey-dashboard-inner">
        <div className="survey-eyebrow">
          <span className="survey-pulse" /> RTRDA / SURVEY INTELLIGENCE
        </div>
        <div className="survey-heading-row">
          <div>
            <p className="survey-kicker">
              ข้อมูลภาพรวม · สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง
            </p>
            <h1>
              ภาพรวม<span>ผลสำรวจ</span>
            </h1>
            <p className="survey-lede">
              มุมมองภาพรวมความคิดเห็นของผู้ตอบแบบสำรวจ เพื่อขับเคลื่อนอนาคตระบบรางไทย
            </p>
          </div>
          <div className="survey-status-wrap">
            <div className={`survey-status survey-status-${state}`} role="status">
              <span className="survey-status-dot" />
              {state === "live"
                ? "ข้อมูลล่าสุด"
                : state === "loading"
                  ? "กำลังโหลดข้อมูล"
                  : "ข้อมูลไม่พร้อมใช้งาน"}
            </div>
            {summary && (
              <span className="survey-updated">
                ดึงข้อมูลเมื่อ {clock.format(new Date(summary.updatedAt))} น.
              </span>
            )}
          </div>
        </div>

        {state === "stale" && (
          <div className="survey-alert" role="alert">
            ไม่สามารถอัปเดตข้อมูลได้ในขณะนี้{" "}
            {summary
              ? "ตัวเลขด้านล่างเป็นข้อมูลจากการดึงครั้งล่าสุด"
              : "กรุณาลองอีกครั้งภายหลัง"}
            <button type="button" onClick={() => void refresh()} disabled={refreshing}>
              ลองใหม่ ↗
            </button>
          </div>
        )}

        {!summary ? (
          <div className="survey-empty" aria-live="polite">
            {state === "loading"
              ? "กำลังเชื่อมต่อข้อมูลสำรวจ…"
              : "ยังไม่มีข้อมูลสรุปที่แสดงได้"}
          </div>
        ) : (
          <>
            <div className="survey-overview">
              <article className="survey-hero-stat">
                <div className="survey-card-top">
                  <span>01 / ภาพรวม</span>
                  <span className="survey-card-mark">↗</span>
                </div>
                <div className="survey-big-number">
                  {format.format(summary.totalResponses)}
                  <span>รายการ</span>
                </div>
                <p>จำนวนแบบสำรวจที่ได้รับทั้งหมด</p>
                <div className="survey-hero-rule" />
                <small>ข้อมูลสรุปและรายละเอียดสำหรับผู้ได้รับอนุญาต</small>
              </article>
              <article className="survey-intro-card">
                <div className="survey-card-top">
                  <span>ABOUT THIS VIEW</span>
                  <span>RTRDA · 2026</span>
                </div>
                <div className="survey-orbit" aria-hidden="true">
                  <span>◉</span>
                </div>
                <h2>
                  จากความคิดเห็น
                  <br />
                  สู่ทิศทางที่ชัดเจน
                </h2>
                <p>
                  สำรวจความต้องการด้านการวิจัย มาตรฐาน บุคลากร
                  และการถ่ายทอดเทคโนโลยีในภาคระบบราง
                </p>
              </article>
            </div>

            <section className="survey-section" aria-labelledby="survey-areas">
              <div className="survey-section-title">
                <div>
                  <span className="survey-section-index">02 / AREAS OF FOCUS</span>
                  <h2 id="survey-areas">ภาพรวมรายด้าน</h2>
                </div>
                <span className="survey-section-note">
                  คะแนนเฉลี่ยจากคำตอบที่มีคะแนน · เต็ม 5
                </span>
              </div>
              <div className="survey-areas">
                {summary.sections.map((section, index) => (
                  <article className="survey-area" key={section.label}>
                    <div className="survey-area-top">
                      <span className="survey-area-index">0{index + 1}</span>
                      <span className="survey-area-score">
                        {section.mean === null ? "—" : section.mean.toFixed(1)}{" "}
                        <small>/ 5</small>
                      </span>
                    </div>
                    <h3>{section.label}</h3>
                    <div
                      className="survey-track"
                      role="meter"
                      aria-label={`คะแนนเฉลี่ย ${section.label}`}
                      aria-valuemin={0}
                      aria-valuemax={5}
                      aria-valuenow={section.mean ?? 0}
                    >
                      <span style={{ width: `${((section.mean ?? 0) / 5) * 100}%` }} />
                    </div>
                    <div className="survey-area-foot">
                      <span>ผู้ตอบในด้านนี้</span>
                      <strong>
                        {format.format(section.completed)}{" "}
                        <small>/ {format.format(summary.totalResponses)}</small>
                      </strong>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section
              className="survey-section survey-distribution"
              aria-labelledby="survey-types"
            >
              <div className="survey-section-title">
                <div>
                  <span className="survey-section-index">03 / RESPONDENT MIX</span>
                  <h2 id="survey-types">ประเภทหน่วยงาน</h2>
                </div>
                <span className="survey-section-note">
                  แสดงเฉพาะกลุ่มที่มีอย่างน้อย 3 คำตอบ
                </span>
              </div>
              <div className="survey-types">
                {summary.organizationTypes.length ? (
                  summary.organizationTypes.map((type, index) => (
                    <div className="survey-type" key={type.label}>
                      <span className="survey-type-no">0{index + 1}</span>
                      <span className="survey-type-label">{type.label}</span>
                      <div className="survey-type-bar" aria-hidden="true">
                        <span
                          style={{
                            width: `${(type.count / summary.totalResponses) * 100}%`,
                          }}
                        />
                      </div>
                      <strong>{format.format(type.count)}</strong>
                    </div>
                  ))
                ) : (
                  <p className="survey-types-empty">
                    ยังไม่มีกลุ่มที่มีจำนวนมากพอสำหรับการแสดงผล
                  </p>
                )}
              </div>
            </section>
            <section
              className="survey-section survey-explorer"
              aria-labelledby="survey-respondents"
            >
              <div className="survey-section-title">
                <div>
                  <span className="survey-section-index">04 / RESPONSE EXPLORER</span>
                  <h2 id="survey-respondents">รายชื่อผู้ตอบ</h2>
                </div>
                <span className="survey-section-note">
                  แสดง {format.format(filtered.length)} จาก{" "}
                  {format.format(data?.responses.length ?? 0)} รายการ ·
                  เลือกเพื่อดูคำตอบทั้งชุด
                </span>
              </div>
              <div className="survey-explorer-controls">
                <label>
                  ค้นหาผู้ตอบหรือคำตอบ
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="ชื่อ อีเมล หรือข้อความคำตอบ"
                  />
                </label>
                <label>
                  กรองตามหน่วยงาน
                  <select
                    value={organization}
                    onChange={(event) => setOrganization(event.target.value)}
                  >
                    <option value="">ทุกหน่วยงาน</option>
                    {organizations.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="survey-response-list">
                {filtered.length ? (
                  filtered.map((response) => (
                    <button
                      key={response.sheetRow}
                      type="button"
                      className="survey-response-item"
                      onClick={() => setSelectedRow(response.sheetRow)}
                    >
                      <span className="survey-response-number">
                        #{format.format(response.sheetRow - 1)}
                      </span>
                      <span>
                        <strong>{nameFor(response.cells, response.sheetRow - 1)}</strong>
                        <small>
                          {organizationFor(response.cells) || "ไม่ระบุหน่วยงาน"}
                        </small>
                      </span>
                      <span className="survey-response-open">ดูคำตอบ ↗</span>
                    </button>
                  ))
                ) : (
                  <p className="survey-response-empty">ไม่พบคำตอบที่ตรงกับเงื่อนไข</p>
                )}
              </div>
            </section>
            <div className="survey-footnote">
              อัปเดตอัตโนมัติทุก 30 วินาที · ข้อมูลรายบุคคลสำหรับผู้ได้รับอนุญาตเท่านั้น
            </div>
            {selected && data && (
              <div
                className="survey-drawer-backdrop"
                onClick={() => setSelectedRow(null)}
              >
                <aside
                  className="survey-drawer"
                  role="dialog"
                  aria-modal="true"
                  aria-label="รายละเอียดคำตอบทั้งหมด"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="survey-drawer-header">
                    <div>
                      <span className="survey-section-index">
                        RESPONSE / #{format.format(selected.sheetRow - 1)}
                      </span>
                      <h2>{nameFor(selected.cells, selected.sheetRow - 1)}</h2>
                      <p>
                        รายละเอียดคำตอบทั้งหมด · {format.format(data.headers.length)}{" "}
                        หัวข้อ
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="ปิดรายละเอียด"
                      onClick={() => setSelectedRow(null)}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="survey-drawer-fields">
                    {data.headers.map((header, index) => (
                      <div className="survey-drawer-field" key={index}>
                        <div className="survey-field-label">
                          <span>{format.format(index + 1).padStart(2, "0")}</span>
                          {header || `หัวข้อ ${index + 1}`}
                        </div>
                        <p>
                          {selected.cells[index] || (
                            <span className="survey-no-answer">ไม่ระบุ</span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                </aside>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
