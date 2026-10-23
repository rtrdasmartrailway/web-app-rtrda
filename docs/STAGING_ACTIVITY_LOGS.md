# Staging website access evidence

Enabled only when `ACTIVITY_LOGGING_ENABLED=true`, `ANALYTICS_ENV=test`, and
`SITE_ORIGIN=https://test.rtrda.or.th`. Production/fallback compose files are unchanged.
Review: `/rtrdaintranet/activity-log`. Reports/export: `/api/analytics/reports`.
Both verify the existing PR Center server-side SSO session. Only root or globally
granted `RTRDA_ADMIN` authority can read data. A department-scoped administrator
does not gain access. No new account, password, or access grant is created.

## Evidence semantics

- `page_request`: origin navigation request, including identifiable bot traffic;
  RSC/prefetch/static assets and private routes are excluded. Downstream page
  status cannot be observed by Next proxy and is explicitly left unknown.
- `page_view`: browser-observed initial render or client-side route navigation.
  React duplicate effects are suppressed; returning A → B → A remains two A views.
- `download_click`: browser click intent. It does not prove a file was received.
- `download_response`: server response prepared for public files, SDC downloads,
  and protected document delivery. HTTP status, method and planned response bytes
  distinguish GET, HEAD, 200, 206, 404 and 416. No claim of recipient completion.
  A PDF viewer may make multiple range requests for one document.
- `redirect_response`: a known campaign redirect issued; not a form submission.

Do not add requests, pageviews, clicks and file responses together as downloads,
visitors or EIT people. JavaScript-disabled visitors have origin request evidence
but no browser pageview. Edge-cached direct file requests may not reach the origin;
browser click observations remain separate. The file handler returns no-store for
future responses, but previously cached edge copies can survive their old TTL.

Stored fields are UTC server time; environment; event UUID/type/channel; normalized
path and file/campaign identity; coarse direct/internal/external source; method;
observed status/outcome; planned bytes; device class; obvious-bot flag; pseudonymous
session key and daily Bangkok IP-group key. Raw IPs, raw user agents, referrer URLs,
query strings, fragments, auth cookies/tokens, form values and bodies are not stored.
The daily IP-group key is an HMAC with the existing protected analytics salt and
is not a person. A browser/tab session rolls over after 30 idle minutes. The
collector sets only a dedicated Secure/HttpOnly/SameSite=Lax pseudonymous session
cookie for server-download correlation, separate from authentication cookies.

## Retention and existing logs

`web_activity_events_v2` is a new Prisma-migrated table. It starts empty; there is no
historical backfill. Calendar cutoff is current Bangkok time minus **three calendar
months**, with month-end clamping, not 90 days. Reports always enforce this cutoff.
With `ACTIVITY_RETENTION_ENABLED=true`, cleanup runs after the first new event and
hourly while that logger process is alive. An idle/stopped process can defer physical
cleanup until collection resumes; expired events remain excluded from reports.

Deletion is restricted to `environment='test'` in this new table. Existing
`web_analytics_events` and `redirect_clicks` are neither imported nor deleted.
When this staging logger is enabled, the public collector and known redirect
route write the minimized V2 event instead of the older collectors. Older Grafana
queries reading legacy tables therefore do not include the new records.
No scheduled deletion of existing real historical logs is activated.

## Review and export

Bangkok date filters (end date inclusive), exact page/file path, event type, and bot
filter; 50 rows per page; grouped event counts; anonymous sessions and daily IP groups.
CSV uses the same authorization/filters, excludes raw identifiers, neutralizes
spreadsheet formula prefixes, and caps each export page at 5,000 rows. Query `page`
for further export pages; `X-Export-Has-More` signals truncation. Data responses are
private/no-store and noindex. Session revocation is checked by the existing SSO API
on each report request; there is no analytics-specific authentication shortcut.

## Validation and release

Use an isolated DGT worktree because the shared Test checkout has unrelated UI edits.
`scripts/check-activity-integration.ts` refuses any database name not beginning with
`rtrda_activity_qa_`; it validates deduplication, bot/session attribution, redaction,
report/export and exact retention boundaries using synthetic records, including
preservation of legacy and production-environment rows.

Apply the additive migration through Prisma deploy to DGT only after confirming
that it is the sole pending local migration. Prisma's synthetic `migrate dev` may
also report pre-existing unrelated PR Center foreign-key update-policy drift;
do not include or apply that repair as part of access logging.

Build a uniquely tagged image carrying the full feature commit. Record the current
Test image ID and revision first. Use existing DGT compose configuration, its
existing env file and project directory plus `docker-compose.activity-test.yml`;
run `up -d --no-build --no-deps web-app-rtrda-test` only. This preserves existing DB,
API, workers, mounts, networks and the shared dirty checkout. Rollback recreates
only that app service with the recorded previous image/revision and logging flags
disabled; leave the additive table intact. Never invoke production promotion.

A feature-branch manual Test deployment does not make a clean release candidate:
the primary checkout and `origin/test` still need a coordinated reviewed merge.
