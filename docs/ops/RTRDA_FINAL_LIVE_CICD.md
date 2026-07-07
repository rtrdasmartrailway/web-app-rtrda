# RTRDA final live CI/CD

There is no pre-prod stage after the 2026-07-07 cutover.

Final flow:

```text
rtrda-dgt test -> Deploy test.rtrda.or.th workflow -> cloud primary + rtrda02 production fallback
```

- DGT test: `https://test.rtrda.or.th`
- Production apex/www: Cloudflare production tunnel -> cloud primary `100.77.64.92:3021`
- Fallback: rtrda02 `100.91.174.121:3021`
- Production watchdog: `/home/rtrda/bin/rtrda-production-watchdog.py` on rtrda02
- Backup timer: `rtrda-web-backup.timer` on rtrda02

Historical pre-prod public route was removed: no DNS record or tunnel for `pre-prod.rtrda.or.th`.

Note: some internal runtime paths/container names still include `preprod` because they were promoted in place during cutover. Operationally they are production primary/fallback now; do not stop them because of the historical name.
