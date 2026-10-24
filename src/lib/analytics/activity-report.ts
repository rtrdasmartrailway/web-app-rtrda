import {
  ACTIVITY_TYPES,
  activityPath,
  csvCell,
  retentionCutoff,
  type ActivityType,
} from "./activity-contract";
import { activityPool } from "./activity-store";

export type ReportFilter = {
  from: Date;
  until: Date;
  path: string | null;
  type: ActivityType | null;
  session: string | null;
  visitor: string | null;
  bots: "all" | "exclude" | "only";
  page: number;
  format: "json" | "csv";
};
function dateBoundary(value: string | null, fallback: Date, end = false): Date {
  if (!value) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Invalid date");
  const date = new Date(`${value}T00:00:00+07:00`);
  if (
    !Number.isFinite(date.getTime()) ||
    new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 10) !== value
  )
    throw new Error("Invalid date");
  if (end) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}
export function reportFilter(search: URLSearchParams, now = new Date()): ReportFilter {
  if (
    [...search.keys()].some(
      (key) =>
        ![
          "from",
          "to",
          "path",
          "type",
          "bots",
          "page",
          "format",
          "session",
          "visitor",
        ].includes(key),
    )
  )
    throw new Error("Unknown filter");
  const cutoff = retentionCutoff(now);
  const from = dateBoundary(search.get("from"), cutoff);
  const until = dateBoundary(search.get("to"), now, true);
  const type = search.get("type") || null;
  const bots = search.get("bots") || "all";
  const session = search.get("session") || null;
  const visitor = search.get("visitor") || null;
  const page = Number(search.get("page") || 1);
  const format = search.get("format") || "json";
  const path = search.get("path") ? activityPath(search.get("path")) : null;
  if (
    (type && !ACTIVITY_TYPES.includes(type as ActivityType)) ||
    (session && !/^[a-f0-9]{16}$/.test(session)) ||
    (visitor && !/^[a-f0-9]{16}$/.test(visitor)) ||
    !["all", "exclude", "only"].includes(bots) ||
    !["json", "csv"].includes(format) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 10000 ||
    (search.get("path") && !path) ||
    from >= until
  )
    throw new Error("Invalid filter");
  return {
    from: from < cutoff ? cutoff : from,
    until: until > now ? now : until,
    path,
    session,
    visitor,
    type: type as ActivityType | null,
    bots: bots as ReportFilter["bots"],
    page,
    format: format as ReportFilter["format"],
  };
}
export function reportWhere(filter: ReportFilter): { sql: string; values: unknown[] } {
  const values: unknown[] = [filter.from, filter.until];
  const clauses = ["environment = 'test'", "occurred_at >= $1", "occurred_at < $2"];
  if (filter.path) {
    values.push(filter.path);
    clauses.push(`(path = $${values.length} OR target_path = $${values.length})`);
  }
  if (filter.session) {
    values.push(filter.session);
    clauses.push(`left(session_key,16) = $${values.length}`);
  }
  if (filter.visitor) {
    values.push(filter.visitor);
    clauses.push(`left(visitor_key,16) = $${values.length}`);
  }
  if (filter.type) {
    values.push(filter.type);
    clauses.push(`event_type = $${values.length}`);
  }
  if (filter.bots !== "all")
    clauses.push(filter.bots === "only" ? "is_bot = true" : "is_bot = false");
  return { sql: clauses.join(" AND "), values };
}
const COLUMNS =
  "occurred_at,event_type,channel,path,target_path,method,status,outcome,response_bytes::text,device_type,is_bot,left(visitor_key,16) AS visitor_key,left(session_key,16) AS session_key";
export async function activityReport(filter: ReportFilter) {
  const { sql, values } = reportWhere(filter);
  const pool = activityPool();
  const limit = filter.format === "csv" ? 5000 : 50;
  const offset = (filter.page - 1) * limit;
  if (offset > 500000) throw new Error("Page limit exceeded");
  const rows = await pool.query(
    `SELECT ${COLUMNS} FROM web_activity_events_v2 WHERE ${sql} ORDER BY occurred_at DESC,event_id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );
  const summary = await pool.query(
    `SELECT count(*)::int AS events,count(DISTINCT session_key)::int AS sessions,count(DISTINCT visitor_key)::int AS ip_days,count(*) FILTER(WHERE is_bot)::int AS bot_events,count(DISTINCT target_path) FILTER(WHERE event_type='download_response' AND method='GET' AND status IN (200,206))::int AS files_served,min(occurred_at) AS first_event,max(occurred_at) AS last_event FROM web_activity_events_v2 WHERE ${sql}`,
    values,
  );
  const types = await pool.query(
    `SELECT event_type,count(*)::int AS count FROM web_activity_events_v2 WHERE ${sql} GROUP BY event_type ORDER BY event_type`,
    values,
  );
  const routes = await pool.query(
    `SELECT path,count(*)::int AS count FROM web_activity_events_v2 WHERE ${sql} GROUP BY path ORDER BY count(*) DESC,path LIMIT 20`,
    values,
  );
  return {
    rows: rows.rows,
    summary: summary.rows[0],
    types: types.rows,
    routes: routes.rows,
    page: filter.page,
    pageSize: limit,
    hasMore: offset + rows.rows.length < summary.rows[0].events,
    window: {
      from: filter.from.toISOString(),
      until: filter.until.toISOString(),
      timezone: "Asia/Bangkok",
      retention: "3 calendar months",
    },
  };
}
export function reportCsv(rows: Record<string, unknown>[]): string {
  const fields = [
    "occurred_at",
    "event_type",
    "channel",
    "path",
    "target_path",
    "method",
    "status",
    "outcome",
    "response_bytes",
    "device_type",
    "is_bot",
    "visitor_key",
    "session_key",
  ];
  return (
    "\uFEFF" +
    [
      fields.map(csvCell).join(","),
      ...rows.map((row) =>
        fields
          .map((field) =>
            csvCell(
              row[field] instanceof Date
                ? (row[field] as Date).toISOString()
                : row[field],
            ),
          )
          .join(","),
      ),
    ].join("\r\n")
  );
}
