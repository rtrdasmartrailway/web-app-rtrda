import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  activityPool,
  RETENTION_SQL,
  writeActivity,
} from "../src/lib/analytics/activity-store";
import {
  activityReport,
  reportFilter,
  reportCsv,
} from "../src/lib/analytics/activity-report";

async function main() {
  const url = new URL(process.env.DATABASE_URL || "http://invalid");
  assert(
    url.pathname.startsWith("/rtrda_activity_qa_"),
    "Synthetic database required; refusing a real database",
  );
  process.env.ACTIVITY_LOGGING_ENABLED = "true";
  process.env.ACTIVITY_RETENTION_ENABLED = "false";
  process.env.ANALYTICS_ENV = "test";
  process.env.SITE_ORIGIN = "https://test.rtrda.or.th";
  process.env.ANALYTICS_HASH_SALT = "synthetic-integration-salt";
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const eventId = randomUUID();
    const headers = new Headers({
      "cf-connecting-ip": "192.0.2.8",
      "user-agent": "Synthetic Googlebot",
      cookie: "private_auth=do-not-store",
    });
    const event = {
      eventId,
      eventType: "download_click" as const,
      path: "/qa?password=do-not-store",
      targetPath: "/qa.pdf?token=do-not-store",
      channel: "client" as const,
      outcome: "click_not_confirmed_download",
      sessionId: randomUUID(),
    };
    assert.equal(await writeActivity(headers, event), true);
    assert.equal(await writeActivity(headers, event), false);
    const stored = (
      await pool.query("SELECT * FROM web_activity_events_v2 WHERE event_id=$1", [
        eventId,
      ])
    ).rows[0];
    assert.equal(stored.path, "/qa");
    assert.equal(stored.target_path, "/qa.pdf");
    assert.equal(stored.is_bot, true);
    assert(!JSON.stringify(stored).includes("do-not-store"));
    assert(!JSON.stringify(stored).includes("192.0.2.8"));
    const report = await activityReport(
      reportFilter(
        new URLSearchParams({ path: "/qa", type: "download_click", bots: "only" }),
      ),
    );
    assert.equal(report.summary.events, 1);
    assert.equal(report.rows.length, 1);
    assert.equal(report.summary.sessions, 1);
    assert(!reportCsv(report.rows).includes("do-not-store"));

    const formId = randomUUID();
    const form = {
      eventId: formId,
      eventType: "outbound_form_click" as const,
      path: "/activity-qa/forms?entry.1=do-not-store",
      targetPath: "/outbound-form/short/cA3FjxyvkR1pKy5k6",
      channel: "client" as const,
      outcome: "outbound_click_not_form_submission",
      sessionId: event.sessionId,
    };
    assert.equal(await writeActivity(headers, form), true);
    assert.equal(await writeActivity(headers, form), false);
    const formRow = (
      await pool.query("SELECT * FROM web_activity_events_v2 WHERE event_id=$1", [formId])
    ).rows[0];
    assert.match(formRow.target_path, /^\/outbound-form\/short\/[a-f0-9]{32}$/);
    assert(!JSON.stringify(formRow).includes("do-not-store"));
    const journey = await activityReport(
      reportFilter(new URLSearchParams({ session: formRow.session_key.slice(0, 16) })),
    );
    assert.equal(journey.summary.events, 2);
    assert.equal(
      journey.types.some((row) => row.event_type === "outbound_form_click"),
      true,
    );
    for (const [method, status, path] of [
      ["GET", 200, "/qa.pdf"],
      ["GET", 206, "/qa.pdf"],
      ["HEAD", 200, "/qa.pdf"],
      ["GET", 404, "/missing.pdf"],
    ] as const) {
      await writeActivity(headers, {
        eventType: "download_response",
        path: "/sdc_download/qa",
        targetPath: path,
        channel: "server",
        method,
        status,
        outcome: "response_prepared_not_confirmed_received",
        sessionId: event.sessionId,
      });
    }
    const files = await activityReport(
      reportFilter(
        new URLSearchParams({
          path: "/qa.pdf",
          session: formRow.session_key.slice(0, 16),
        }),
      ),
    );
    assert.equal(files.summary.files_served, 1);
    assert.equal(
      files.rows.filter((row) => row.event_type === "download_response").length,
      3,
    );
    assert(!reportCsv(journey.rows).includes("do-not-store"));

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "CREATE TABLE IF NOT EXISTS redirect_clicks (id int primary key); INSERT INTO redirect_clicks VALUES(1) ON CONFLICT DO NOTHING",
      );
      await client.query(
        "CREATE TABLE IF NOT EXISTS web_analytics_events (id int primary key); INSERT INTO web_analytics_events VALUES(1) ON CONFLICT DO NOTHING",
      );
      const old = randomUUID(),
        boundary = randomUUID(),
        fresh = randomUUID(),
        production = randomUUID();
      const cutoff =
        "((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok' - INTERVAL '3 months') AT TIME ZONE 'Asia/Bangkok')";
      for (const [id, offset, environment] of [
        [old, "- interval '1 second'", "test"],
        [boundary, "", "test"],
        [fresh, "+ interval '1 second'", "test"],
        [production, "- interval '1 second'", "production"],
      ]) {
        await client.query(
          `INSERT INTO web_activity_events_v2 (event_id,environment,event_type,path,source,channel,outcome,device_type,occurred_at) VALUES ($1,$2,'page_view','/synthetic-retention','direct','client','browser_observed','unknown',${cutoff} ${offset})`,
          [id, environment],
        );
      }
      const result = await client.query(RETENTION_SQL);
      assert.equal(result.rowCount, 1);
      assert.equal(
        (
          await client.query(
            "SELECT count(*)::int AS n FROM web_activity_events_v2 WHERE event_id=ANY($1::uuid[])",
            [[boundary, fresh, production]],
          )
        ).rows[0].n,
        3,
      );
      assert.equal(
        (await client.query("SELECT count(*)::int AS n FROM redirect_clicks")).rows[0].n,
        1,
      );
      assert.equal(
        (await client.query("SELECT count(*)::int AS n FROM web_analytics_events"))
          .rows[0].n,
        1,
      );
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
    console.log(
      "PASS: migrated synthetic database; event deduplication; query/PII minimization; bot/session attribution; report/journey filters and outbound form events; distinct file count excluding HEAD/range repetition; exact calendar-month retention boundary; legacy and production rows preserved.",
    );
  } finally {
    await pool.end();
    await activityPool().end();
  }
}
main().catch(() => {
  console.error("Activity integration check failed");
  process.exitCode = 1;
});
