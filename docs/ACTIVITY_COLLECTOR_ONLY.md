# Activity collector-only release design (owner-approved)

Decision: begin recording on both Production targets before Entra is provisioned; keep the viewer unavailable. Release approval is a separate exact-SHA gate. No Production target is changed by this design.

- `off`: no V2 overlay; preserve the restricted legacy Production collector.
- `collect`: V2 recording and three-calendar-month retention; target-bound database and host; protected per-target 0600 salt bind-mounted read-only into the app. Do not require an OIDC file or build/start `activity-report-auth`. Report UI and reporting/login APIs return 404; private auth service must not be running in the Compose project. Logs remain physically separate on Cloud and RTRDA02.
- `stage`: recording off, auth service on for a later Entra-specific exercise.
- `active`: recording and auth service on. Future enabling requires separate credential provisioning and approval.

Implementation gate: Test/RC must exercise the exact candidate, synthetic overlay config and mode transitions including rollback; production workflow preserves live mode on later releases and attests parity/secret mounts without reading secret values. If changing from an auth mode to collector-only, stop only the private auth service **after** the new app passes health; on failure, restore prior Compose/overlay/app and auth. Never stop the database or assume checkout rollback reverses DB migration/seed. A changed content manifest still needs a protected DB backup and verified restore gate before Production promotion.

Operations: owner-requested reports are read-only and bounded, delivered only through approved administrative tooling. Each report must state Cloud or RTRDA02 source, date window, event filters, row/export limit and pagination. No raw IP, form answers, protected salt or database credential may enter a chat. Preserve the three-calendar-month retention schedule and document that no retroactive events exist before activation. Do not claim collection is live until exact-SHA deploy and event readback on both targets pass.
