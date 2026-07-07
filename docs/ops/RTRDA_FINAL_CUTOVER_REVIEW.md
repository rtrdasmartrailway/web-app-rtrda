# RTRDA final cutover review pack

This branch prepares the final review before converting the current pre-prod candidate into main/production.

It intentionally does **not** cut over `rtrda.or.th` / `www.rtrda.or.th`.

## What is staged

- rtrda02 backup automation:
  - `/home/rtrda/bin/rtrda-web-backup.sh`
  - enabled timer: `rtrda-web-backup.timer`
  - quick DB/metadata backup root: `/home/rtrda/backups/rtrda-web`
- rtrda02 production watchdog template:
  - `/home/rtrda/bin/rtrda-production-watchdog.py`
  - systemd user unit/timer installed but timer intentionally disabled until cutover approval
  - safe by default; Cloudflare writes require both `--apply` and arm file `/home/rtrda/.rtrda-production-watchdog-armed`
- cloud VM production tunnel connector staging:
  - token file: `/home/ubuntu/.cloudflared-rtrda-production/connector_token`
  - service: `cloudflared-rtrda-production.service`
  - service intentionally disabled until cutover approval
- GitHub Actions readiness workflow template:
  - `.github/workflows/rtrda-final-cutover-readiness.yml`

## Final check command expectations

- `test.rtrda.or.th` healthy
- current cloud candidate and rtrda02 fallback candidate have the same SHA as DGT test
- `pre-prod.rtrda.or.th` still healthy before cutover
- rtrda02 backup timer active
- production watchdog and cloud production connector staged but disabled

## Cutover still requires explicit พี่ J approval

Actual cutover step will update Cloudflare production ingress and/or DNS routing for apex/www. Do not run it from this branch without owner approval.
