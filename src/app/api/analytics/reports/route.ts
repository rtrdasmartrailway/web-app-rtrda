import { requireActivityAdmin, PRIVATE_HEADERS } from "@/lib/analytics/activity-auth";
import { activityEnabled, activityHostAllowed } from "@/lib/analytics/activity-store";
import { activityRecordingSource, activityReport, reportCsv, reportFilter } from "@/lib/analytics/activity-report";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  if (process.env.ACTIVITY_REPORT_ENABLED === "false") return Response.json({ error: "Report unavailable" }, { status: 404, headers: PRIVATE_HEADERS });
  const denied = await requireActivityAdmin(request.headers);
  if (denied) return denied;
  if (!activityEnabled() || !activityHostAllowed(request.headers)) return Response.json({ error: "Activity logging is disabled" }, { status: 503, headers: PRIVATE_HEADERS });
  let filter;
  try { filter = reportFilter(new URL(request.url).searchParams); }
  catch { return Response.json({ error: "Invalid date, route, event, bot, or page filter" }, { status: 400, headers: PRIVATE_HEADERS }); }
  try {
    const report = await activityReport(filter);
    if (filter.format === "csv") return new Response(reportCsv(report.rows), { headers: { ...PRIVATE_HEADERS, "X-Activity-Recording-Source": activityRecordingSource(), "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=activity.csv", "X-Export-Limit": "5000", "X-Export-Has-More": String(report.hasMore) } });
    return Response.json(report, { headers: PRIVATE_HEADERS });
  } catch { return Response.json({ error: "Activity report temporarily unavailable" }, { status: 503, headers: PRIVATE_HEADERS }); }
}
