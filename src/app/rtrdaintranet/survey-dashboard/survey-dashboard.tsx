"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SurveyData } from "@/lib/survey/google-sheets";
import { buildSurveyOverlap } from "@/lib/survey/survey-overlap";

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
  const [moheOnly, setMoheOnly] = useState(true);
  const [areaFilter, setAreaFilter] = useState("ทั้งหมด");
  const [expandedActivity, setExpandedActivity] = useState<number | null>(null);
  const overlap = useMemo(
    () => (data ? buildSurveyOverlap(data.headers, data.responses, moheOnly) : null),
    [data, moheOnly],
  );
  const topActivities =
    overlap?.areas
      .flatMap((area) =>
        area.activities.map((activity) => ({ ...activity, area: area.label })),
      )
      .sort((a, b) => b.direct.length - a.direct.length || a.column - b.column)
      .slice(0, 5) ?? [];
  const focusActivity = (area: string, column: number) => {
    setAreaFilter(area);
    setExpandedActivity(column);
    window.requestAnimationFrame(() => {
      document.getElementById(`survey-activity-${column}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  };
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
      .join(" ") ||
    cells[4]?.trim() ||
    `ผู้ตอบลำดับ ${row}`;
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
              แผนที่<span>กิจกรรมร่วม</span>
            </h1>
            <p className="survey-lede">
              30 กิจกรรมที่ สทร. ดำเนินงาน
              เทียบกับระดับบทบาทที่หน่วยงานอื่นรายงานด้วยตนเอง
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
                  จากกิจกรรมที่ทำร่วมกัน
                  <br />
                  สู่การแบ่งบทบาทที่ชัดเจน
                </h2>
                <p>
                  หน่วยงานที่ให้คะแนนบทบาทตนเอง 3–4 ทำกิจกรรมประเภทเดียวกับ สทร.
                  ต้องตรวจโครงการและผลผลิตก่อนสรุปว่างานซ้ำซ้อนจริง
                </p>
              </article>
            </div>

            {overlap && (
              <section
                className="survey-section survey-overlap"
                aria-labelledby="survey-overlap-title"
              >
                <div className="survey-section-title">
                  <div>
                    <span className="survey-section-index">02 / FUNCTIONAL ROLE MAP</span>
                    <h2 id="survey-overlap-title">
                      กิจกรรมของ สทร. ที่หน่วยงานอื่นทำเช่นกัน
                    </h2>
                  </div>
                  <span className="survey-section-note">
                    อัปเดตตามคำตอบในชีต · คะแนน 3–4 = ดำเนินการโดยตรง/บทบาทนำ
                  </span>
                </div>
                <div className="survey-overlap-controls">
                  <label>
                    ขอบเขตหน่วยงาน
                    <select
                      aria-label="ขอบเขตหน่วยงาน"
                      value={moheOnly ? "mohe" : "all"}
                      onChange={(event) => {
                        setMoheOnly(event.target.value === "mohe");
                        setExpandedActivity(null);
                      }}
                    >
                      <option value="mohe">สังกัด อว. ที่ระบุชัดเจน</option>
                      <option value="all">หน่วยงานผู้ตอบทั้งหมด</option>
                    </select>
                  </label>
                  <label>
                    กลุ่มกิจกรรม
                    <select
                      aria-label="กลุ่มกิจกรรม"
                      value={areaFilter}
                      onChange={(event) => {
                        setAreaFilter(event.target.value);
                        setExpandedActivity(null);
                      }}
                    >
                      <option value="ทั้งหมด">ทั้งหมด 5 ด้าน</option>
                      {overlap.areas.map((area) => (
                        <option key={area.label} value={area.label}>
                          {area.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="survey-overlap-kpis">
                  <div>
                    <strong>{format.format(overlap.similarActivityCount)} / 30</strong>
                    <span>กิจกรรมที่มีอย่างน้อยหนึ่งหน่วยงานรายงานว่าทำโดยตรง</span>
                  </div>
                  <div>
                    <strong>{format.format(overlap.agencyCount)}</strong>
                    <span>ชื่อหน่วยงานในขอบเขตที่เลือก (ใช้คำตอบล่าสุดต่อชื่อ)</span>
                  </div>
                  <div>
                    <strong>{format.format(overlap.responseCount)}</strong>
                    <span>คำตอบทั้งหมดในชีต ก่อนจัดกลุ่มชื่อหน่วยงาน</span>
                  </div>
                </div>
                <p className="survey-overlap-caveat">
                  “ทำกิจกรรมประเภทเดียวกัน” ไม่ใช่ข้อสรุปว่าโครงการ งบประมาณ
                  หรือผลผลิตซ้ำกันจริง · มุมมอง อว. นับเฉพาะช่องสังกัดที่ระบุ อว.
                  หรืออุดมศึกษาชัดเจน
                </p>
                <div
                  className="survey-infographic"
                  aria-label="อินโฟกราฟิกกิจกรรมร่วม 30 กิจกรรม"
                >
                  <div className="survey-infographic-head">
                    <div>
                      <span className="survey-infographic-eyebrow">
                        30-ACTIVITY / ROLE SIGNAL MAP
                      </span>
                      <h3>แผนที่ความหนาแน่นกิจกรรมร่วม</h3>
                      <p>
                        แต่ละช่องคือ 1 กิจกรรมของ สทร. ·
                        ตัวเลขคือจำนวนหน่วยงานที่ระบุว่าดำเนินการเองหรือเป็นบทบาทนำ
                      </p>
                    </div>
                    <div className="survey-infographic-total">
                      <strong>{format.format(overlap.similarActivityCount)}</strong>
                      <span>
                        จาก 30 กิจกรรม
                        <br />
                        มีผู้ดำเนินการร่วม
                      </span>
                    </div>
                  </div>
                  <div className="survey-infographic-legend" aria-label="คำอธิบายระดับสี">
                    <span>
                      <i className="survey-density survey-density-0" /> 0 หน่วยงาน
                    </span>
                    <span>
                      <i className="survey-density survey-density-1" /> 1–2 หน่วยงาน
                    </span>
                    <span>
                      <i className="survey-density survey-density-2" /> 3–4 หน่วยงาน
                    </span>
                    <span>
                      <i className="survey-density survey-density-3" /> 5 หน่วยงานขึ้นไป
                    </span>
                  </div>
                  <div className="survey-infographic-lanes">
                    {overlap.areas.map((area, index) => (
                      <div
                        className={`survey-infographic-lane${areaFilter !== "ทั้งหมด" && areaFilter !== area.label ? " survey-infographic-lane-muted" : ""}`}
                        key={area.label}
                      >
                        <div className="survey-infographic-lane-label">
                          <span>0{index + 1} / 05</span>
                          <strong>{area.label}</strong>
                        </div>
                        <div className="survey-infographic-cells">
                          {area.activities.map((activity, position) => {
                            const count = activity.direct.length;
                            const density =
                              count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : 3;
                            return (
                              <button
                                type="button"
                                key={activity.column}
                                className={`survey-infographic-cell survey-density-${density}${expandedActivity === activity.column ? " survey-infographic-cell-active" : ""}`}
                                aria-label={`${area.label} กิจกรรม ${position + 1}: ${activity.title} — ${count} หน่วยงานดำเนินการโดยตรง`}
                                title={`${activity.title} · ${count} หน่วยงาน`}
                                onClick={() => focusActivity(area.label, activity.column)}
                              >
                                <span className="survey-infographic-cell-index">
                                  {String(position + 1).padStart(2, "0")}
                                </span>
                                <strong>{format.format(count)}</strong>
                                <span className="survey-infographic-cell-text">
                                  หน่วยงาน
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="survey-infographic-rank">
                    <div>
                      <span className="survey-infographic-eyebrow">PRIORITY VIEW</span>
                      <h4>กิจกรรมที่มีผู้ทำร่วมมากที่สุด</h4>
                      <p>
                        เรียงตามจำนวนหน่วยงานในขอบเขตที่เลือก
                        ไม่ใช่อันดับความซ้ำซ้อนของงบประมาณ
                      </p>
                    </div>
                    <ol>
                      {topActivities.map((activity, index) => (
                        <li key={activity.column}>
                          <button
                            type="button"
                            onClick={() => focusActivity(activity.area, activity.column)}
                          >
                            <span className="survey-infographic-rank-no">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="survey-infographic-rank-title">
                              <small>{activity.area}</small>
                              <strong>{activity.title}</strong>
                            </span>
                            <span
                              className="survey-infographic-rank-bar"
                              aria-hidden="true"
                            >
                              <i
                                style={{
                                  width: `${overlap.agencyCount ? (activity.direct.length / overlap.agencyCount) * 100 : 0}%`,
                                }}
                              />
                            </span>
                            <span className="survey-infographic-rank-value">
                              {format.format(activity.direct.length)} /{" "}
                              {format.format(overlap.agencyCount)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <p className="survey-infographic-footer">
                    แตะช่องสีหรืออันดับเพื่อดูชื่อหน่วยงานและคำตอบประกอบ ·
                    ข้อมูลอัปเดตอัตโนมัติทุก 30 วินาที
                  </p>
                </div>
                {overlap.areas
                  .filter((area) => areaFilter === "ทั้งหมด" || area.label === areaFilter)
                  .map((area) => (
                    <div className="survey-overlap-area" key={area.label}>
                      <h3>
                        {area.label}{" "}
                        <small>
                          {format.format(
                            area.activities.filter((activity) => activity.direct.length)
                              .length,
                          )}{" "}
                          / 6 กิจกรรมมีผู้ดำเนินการร่วม
                        </small>
                      </h3>
                      <div className="survey-overlap-activities">
                        {area.activities.map((activity) => (
                          <div
                            className="survey-overlap-item"
                            id={`survey-activity-${activity.column}`}
                            key={activity.column}
                          >
                            <button
                              type="button"
                              className="survey-overlap-activity"
                              aria-expanded={expandedActivity === activity.column}
                              onClick={() =>
                                setExpandedActivity(
                                  expandedActivity === activity.column
                                    ? null
                                    : activity.column,
                                )
                              }
                            >
                              <span className="survey-overlap-index">
                                {format
                                  .format(activity.column - area.activities[0].column + 1)
                                  .padStart(2, "0")}
                              </span>
                              <span className="survey-overlap-name">
                                {activity.title}
                              </span>
                              <span className="survey-overlap-count">
                                <strong>{format.format(activity.direct.length)}</strong>{" "}
                                หน่วยงานทำโดยตรง
                              </span>
                              <span className="survey-overlap-toggle">
                                {expandedActivity === activity.column ? "−" : "+"}
                              </span>
                            </button>
                            {expandedActivity === activity.column && (
                              <div className="survey-overlap-detail">
                                <p>
                                  ผู้สนับสนุน/ร่วมดำเนินการ (คะแนน 2):{" "}
                                  {format.format(activity.supporting)} · ตอบข้อนี้:{" "}
                                  {format.format(activity.answered)} จาก{" "}
                                  {format.format(overlap.agencyCount)} หน่วยงาน
                                </p>
                                {activity.direct.length ? (
                                  activity.direct.map((agency) => (
                                    <button
                                      type="button"
                                      key={agency.sheetRow}
                                      onClick={() => setSelectedRow(agency.sheetRow)}
                                    >
                                      <span>{agency.name}</span>
                                      <strong>ระดับ {agency.score} · ดูคำตอบ ↗</strong>
                                    </button>
                                  ))
                                ) : (
                                  <p>
                                    ยังไม่มีหน่วยงานในขอบเขตที่เลือกรายงานว่าดำเนินการเอง
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </section>
            )}

            <section className="survey-section" aria-labelledby="survey-areas">
              <div className="survey-section-title">
                <div>
                  <span className="survey-section-index">03 / SUPPORTING CONTEXT</span>
                  <h2 id="survey-areas">คะแนนบทบาทรายด้าน</h2>
                </div>
                <span className="survey-section-note">
                  คะแนนเฉลี่ยจากคำตอบทั้งหมดที่มีคะแนน · เต็ม 4 · ไม่ใช่ดัชนีความซ้ำซ้อน
                </span>
              </div>
              <div className="survey-areas">
                {summary.sections.map((section, index) => (
                  <article className="survey-area" key={section.label}>
                    <div className="survey-area-top">
                      <span className="survey-area-index">0{index + 1}</span>
                      <span className="survey-area-score">
                        {section.mean === null ? "—" : section.mean.toFixed(1)}{" "}
                        <small>/ 4</small>
                      </span>
                    </div>
                    <h3>{section.label}</h3>
                    <div
                      className="survey-track"
                      role="meter"
                      aria-label={`คะแนนเฉลี่ย ${section.label}`}
                      aria-valuemin={0}
                      aria-valuemax={4}
                      aria-valuenow={section.mean ?? 0}
                    >
                      <span style={{ width: `${((section.mean ?? 0) / 4) * 100}%` }} />
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
                  ตัวเลือก 8 ประเภท + ระบุเอง · แสดงครบแม้ยังไม่มีผู้เลือก
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
                  <p className="survey-types-empty">ยังไม่มีข้อมูลประเภทหน่วยงาน</p>
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
                  <h2 id="survey-respondents">รายการคำตอบและผู้ประสานงาน</h2>
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
