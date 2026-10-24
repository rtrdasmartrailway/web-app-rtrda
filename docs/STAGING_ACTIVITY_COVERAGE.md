# Staging activity coverage and production handoff

Scope: test.rtrda.or.th only. Existing CMS and production/fallback are unchanged.
Review: `/rtrdaintranet/activity-log` with existing global admin SSO.

## Link inventory observed in staging HTML

Public TH/EN routes: `/ติดต่อเรา/ช่องทางการติดต่อ`, `/e-services`,
`/ช่องทางการแจ้งเรื่องกา`, `/ช่องทางการแจ้งเรื่องร้`,
`/ข่าวสาร-กิจกรรม/ร่วมงานกับ-สทร/สมัครงาน` and their `/en` equivalents.
Portal menu anchors were also observed on `/rtrdaintranet` and `/rtrdaintranet/blog`.
The two contact forms cover contact and data requests; corruption complaints,
complaints/whistleblowing and recruitment have their own destinations. Portal links
cover meeting room, car booking, Report Helpdesk and two unlabeled quick icons.
Inventory total: ten distinct responder destinations; no forms were submitted.

Known public responder keys (parameters are never retained):

| Label | Canonical responder identity before server hashing |
| --- | --- |
| Contact | published/1FAIpQLSd8nY4Dt-vjvl6Ag4Jnwq_Ko5zEUT7FgKH8DB-wql74KAVe5w |
| Data request | published/1FAIpQLScrePVLCQoUuYCxa28oOmfU1MUNQG8dMPkC8KzSbxgkAt6oGw |
| Corruption complaint | published/1FAIpQLSfPUmOqZ1xL9-fSK1tFGD6bNwGZpCIxT0TV_qj8kpuxiBh4OA |
| Complaints/whistleblowing | short/cA3FjxyvkR1pKy5k6 |
| Recruitment | short/7dDi6PVKsE9WGVQc6 |
| Meeting room | published/1FAIpQLScmEztgRzR7ar4-xyI1o8ldU3xIHrYwOA1MX5ljOOhoQhU4LA |
| Car booking | published/1FAIpQLSdAHR4roxS-UXC40YjQj-bK4nemI9Y752t5pI8Uv5ZO01oOEw |
| Report Helpdesk | published/1FAIpQLSeeAC917cMzuJ6u8cdCMoy1hYe0a8rn5OUrAYPL2oEc2jTqEQ |
| Quick icon 05 (no text label) | published/1FAIpQLSc0IDiYIS0blmY5G8yksUrmXOSVUNcbWkn3ZtGbo1k84jNiCw |
| Quick icon 06 (no text label) | published/1FAIpQLSeJS1fSlq9YcaTDkdBJRBMLpy4p1XuJ7_5ABGGxzae8nNu08Q |

Stored key: `/outbound-form/<kind>/<first32hex(SHA256('/outbound-form/'+identity))>`.
Short links and their long destination are separate identities unless explicitly
mapped; no network expansion or ownership inference is performed.

## Coverage semantics

| Path/action | Evidence | Boundary |
| --- | --- | --- |
| Every public App Router route, TH/EN | root tracker page_view; origin page_request | hydration/JS and origin reachability required respectively; no exhaustive claim that each historical route was visited |
| Client navigation A → B → A | page_view for each observed normalized route | no extra page_request for RSC/prefetch; StrictMode duplicate suppressed |
| Static root PDF, wp-content/uploads, sdc-downloads, risk-reports | download_response via allowlisted file handler | prepared response, not recipient completion; only supported public document extensions |
| `/sdc_download/<id>` | download_response with resolved canonical local file | alias and direct URL share distinct-file identity |
| Embedded PDF viewer | browser click/page evidence plus origin file GET/range responses | no proof the user read/rendered each page; browser cache can avoid origin |
| Range/HEAD/error requests | status/method/bytes recorded separately | distinct-file card counts only GET200/206 target paths, so HEAD/range repeats cannot inflate it |
| Contact/complaint/recruitment/portal Google Form anchors | outbound_form_click with normalized source and hashed identity | click only; no data inside Google Form and no completion claim |
| `/r/mot-5440` | redirect_response | campaign redirect, not form submission; distinct event vocabulary |
| Private report/export | existing global-admin SSO on each read | no public analytics access; no new grant |

Dedicated event retention remains three Bangkok calendar months. No historical
backfill, legacy purge or change to existing log retention.

## Production readiness steps and remaining limits

1. Review and coordinate merge of this exact staging commit with the shared Test
   branch (unrelated UI edits were preserved); obtain an approved release SHA.
2. Obtain separate production deployment approval. The current logger deliberately
   activates only for the exact staging environment; production enablement needs
   a reviewed explicit environment/retention scope, protected salt and migration.
3. Verify existing production SSO/global-admin access and migration compatibility;
   back up according to the release pipeline and deploy the same SHA to both
   primary and fallback only after approved dry-run/backup gates.
4. Verify production CDN rules and old static cache TTL. `no-store` on new origin
   responses cannot invalidate old edge/browser caches. Edge hits that bypass the
   app and cached embedded PDFs are unobservable here; do not promise every view.
   Edge analytics integration or cache invalidation would require separate work.
5. Compare pageviews, origin requests, file responses, clicks and pseudonymous
   journeys as different measures. NAT/shared IPs, cookie expiry, multiple devices,
   bots and blocked transport prevent treating these as unique people or EIT persons.

Live deployment checks and exact observed records are recorded in the accompanying
staging verification evidence; this matrix describes the collection mechanism and
limits, not an assertion that every route/file has been viewed.
