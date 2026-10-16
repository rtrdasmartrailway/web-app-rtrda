"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  PlatformDistribution,
  PlatformMetric,
  PlatformName,
  PlatformPeriod,
} from "@/lib/pr-center/platform-distribution-data";
import { PLATFORM_NAMES } from "@/lib/pr-center/platform-distribution-data";
import styles from "./pr-center-platform-chart.module.css";

const METRICS: Array<{ id: PlatformMetric; th: string; en: string }> = [
  { id: "posts", th: "จำนวนโพสต์", en: "Posts" },
  { id: "viewers", th: "ผู้ชม", en: "Viewers" },
  { id: "comments", th: "คอมเมนต์", en: "Comments" },
];

const COLORS = [
  "#188b75",
  "#4779d0",
  "#e0a12b",
  "#8c63c7",
  "#e06c54",
  "#4b9db5",
  "#ac6a9d",
];

type Props = { language: "th" | "en" };
type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: PlatformDistribution };

export default function PrCenterPlatformChart({ language }: Props) {
  const thai = language === "th";
  const [metric, setMetric] = useState<PlatformMetric>("posts");
  const [period, setPeriod] = useState<PlatformPeriod>("all");
  const [platform, setPlatform] = useState<PlatformName | "all">("all");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => {
    setState({ status: "loading" });
    setRefreshKey((value) => value + 1);
  };

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const params = new URLSearchParams({ period });
    if (platform !== "all") params.set("platform", platform);
    fetch(`/api/pr-center/executive/platform-distribution?${params}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Spreadsheet data is unavailable");
        return (await response.json()) as PlatformDistribution;
      })
      .then((data) => {
        if (active) setState({ status: "ready", data });
      })
      .catch(() => {
        if (active && !controller.signal.aborted) setState({ status: "error" });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [refreshKey, period, platform]);

  const selectedMetric = METRICS.find((item) => item.id === metric)!;
  const data = state.status === "ready" ? state.data : null;
  const total = data?.totals[metric] ?? 0;
  const formatNumber = useMemo(
    () => new Intl.NumberFormat(thai ? "th-TH" : "en-US").format,
    [thai],
  );
  const segments =
    data?.platforms
      .filter((platform) => platform[metric] > 0)
      .map((platform) => ({
        name: platform.name,
        value: platform[metric],
        color: COLORS[PLATFORM_NAMES.indexOf(platform.name)],
      })) ?? [];
  const gradient = segments
    .map((segment, index) => {
      const start =
        (segments.slice(0, index).reduce((sum, item) => sum + item.value, 0) / total) *
        100;
      const end = (start / 100 + segment.value / total) * 100;
      return `${segment.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <label>
            {thai ? "ช่วงเวลา" : "Period"}
            <select
              value={period}
              onChange={(event) => {
                setPeriod(event.target.value as PlatformPeriod);
                setState({ status: "loading" });
              }}
            >
              <option value="all">{thai ? "ทั้งหมด" : "All time"}</option>
              <option value="7">{thai ? "7 วันล่าสุด" : "Last 7 days"}</option>
              <option value="30">{thai ? "30 วันล่าสุด" : "Last 30 days"}</option>
              <option value="90">{thai ? "90 วันล่าสุด" : "Last 90 days"}</option>
            </select>
          </label>
          <label>
            {thai ? "แพลตฟอร์ม" : "Platform"}
            <select
              value={platform}
              onChange={(event) => {
                setPlatform(event.target.value as PlatformName | "all");
                setState({ status: "loading" });
              }}
            >
              <option value="all">{thai ? "ทุกแพลตฟอร์ม" : "All platforms"}</option>
              {PLATFORM_NAMES.map((name) => (
                <option value={name} key={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div
          className={styles.metricGroup}
          role="group"
          aria-label={thai ? "เลือกตัวชี้วัด" : "Select metric"}
        >
          {METRICS.map((item) => (
            <button
              aria-pressed={metric === item.id}
              className={metric === item.id ? styles.selectedMetric : styles.metricButton}
              key={item.id}
              onClick={() => setMetric(item.id)}
              type="button"
            >
              {thai ? item.th : item.en}
            </button>
          ))}
        </div>
        <button
          className={styles.refreshButton}
          disabled={state.status === "loading"}
          onClick={refresh}
          type="button"
        >
          {thai ? "↻ รีเฟรช" : "↻ Refresh"}
        </button>
      </div>

      {state.status === "loading" && (
        <div className={styles.message} aria-live="polite">
          {thai ? "กำลังดึงข้อมูลจาก Google Sheets…" : "Loading Google Sheets data…"}
        </div>
      )}
      {state.status === "error" && (
        <div className={styles.message} role="status">
          <p>
            {thai
              ? "ยังดึงข้อมูลจากชีตไม่ได้ กรุณาตรวจสิทธิ์การเข้าถึงและลองรีเฟรชอีกครั้ง"
              : "The spreadsheet could not be read. Check its access and try refreshing."}
          </p>
          <button className={styles.retryButton} onClick={refresh} type="button">
            {thai ? "ลองอีกครั้ง" : "Try again"}
          </button>
        </div>
      )}
      {data && data.recordCount === 0 && (
        <div className={styles.message}>
          <strong>{thai ? "ยังไม่มีข้อมูลรายการ" : "No records yet"}</strong>
          <p>
            {thai
              ? "เมื่อผู้รับผิดชอบกรอกข้อมูลใน Google Sheets แล้ว ระบบจะแสดงสัดส่วนจากข้อมูลจริงที่นี่"
              : "Once the team enters records in Google Sheets, their real proportions will appear here."}
          </p>
        </div>
      )}
      {data && data.recordCount > 0 && total === 0 && (
        <div className={styles.message}>
          {thai
            ? `มี ${formatNumber(data.recordCount)} รายการ แต่ยังไม่มีค่า${selectedMetric.th}ที่มากกว่า 0`
            : `${formatNumber(data.recordCount)} records found, but no ${selectedMetric.en.toLowerCase()} above 0.`}
        </div>
      )}
      {data && data.recordCount > 0 && total > 0 && (
        <div className={styles.chartLayout}>
          <div
            aria-label={`${thai ? "สัดส่วน" : "Distribution"} ${thai ? selectedMetric.th : selectedMetric.en}`}
            className={styles.pie}
            role="img"
            style={{ background: `conic-gradient(${gradient})` }}
          >
            <span className={styles.pieCenter}>
              <strong>{formatNumber(data.totals.posts)}</strong>
              <small>{thai ? "โพสต์" : "posts"}</small>
            </span>
          </div>
          <div className={styles.legend}>
            <div className={styles.totalLine}>
              <span>
                {thai
                  ? `รวม${selectedMetric.th}`
                  : `Total ${selectedMetric.en.toLowerCase()}`}
              </span>
              <strong>{formatNumber(total)}</strong>
            </div>
            {data.platforms.map((platform, index) => {
              const value = platform[metric];
              const percent = total > 0 ? (value / total) * 100 : 0;
              return (
                <div className={styles.legendRow} key={platform.name}>
                  <span className={styles.platformLabel}>
                    <i aria-hidden="true" style={{ backgroundColor: COLORS[index] }} />
                    {platform.name}
                  </span>
                  <span className={styles.legendValue}>
                    {formatNumber(value)} <small>({percent.toFixed(1)}%)</small>
                  </span>
                </div>
              );
            })}
            {data.unclassifiedRows > 0 && (
              <p className={styles.warning}>
                {thai
                  ? `ไม่นับ ${formatNumber(data.unclassifiedRows)} แถว เพราะไม่มีหัวข้อแพลตฟอร์มที่กำหนด`
                  : `${formatNumber(data.unclassifiedRows)} rows excluded because their platform is blank or unrecognized.`}
              </p>
            )}
          </div>
        </div>
      )}
      {data?.sampleData && (
        <p className={styles.warning} role="status">
          {thai
            ? "ข้อมูลใน Google Sheets เป็นตัวอย่างสมมติสำหรับทดสอบกราฟ ยังไม่ใช่ข้อมูลการเผยแพร่จริง"
            : "Google Sheets currently contains sample data for chart testing, not actual published posts."}
        </p>
      )}
      {data && (
        <p className={styles.sourceNote}>
          {thai
            ? `ข้อมูลจาก Google Sheets · ${formatNumber(data.recordCount)} รายการ · ดึงข้อมูลเมื่อ ${new Date(data.fetchedAt).toLocaleString("th-TH")}`
            : `Source: Google Sheets · ${formatNumber(data.recordCount)} records · Retrieved ${new Date(data.fetchedAt).toLocaleString("en-US")}`}
        </p>
      )}
    </div>
  );
}
