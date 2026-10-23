import { requireActivityAdmin, PRIVATE_HEADERS } from "@/lib/analytics/activity-auth";
import { activityEnabled } from "@/lib/analytics/activity-store";
import { activityReport, reportCsv, reportFilter } from "@/lib/analytics/activity-report";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  const denied = await requireActivityAdmin(request.headers);
  if (denied) return denied;
  if (!activityEnabled()) return Response.json({ error: "Staging activity logging is disabled" }, { status: 503, headers: PRIVATE_HEADERS });
  let filter;
  try { filter = reportFilter(new URL(request.url).searchParams); }
  catch { return Response.json({ error: "Invalid date, route, event, bot, or page filter" }, { status: 400, headers: PRIVATE_HEADERS }); }
  try {
    const report = await activityReport(filter);
    if (filter.format === "csv") return new Response(reportCsv(report.rows), { headers: { ...PRIVATE_HEADERS, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=staging-activity.csv", "X-Export-Limit": "5000", "X-Export-Has-More": String(report.hasMore) } });
    return Response.json(report, { headers: PRIVATE_HEADERS });
  } catch { return Response.json({ error: "Activity report temporarily unavailable" }, { status: 503, headers: PRIVATE_HEADERS }); }
}
