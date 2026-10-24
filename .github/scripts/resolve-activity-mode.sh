#!/usr/bin/env bash
# Manual workflow only. preserve reads both live targets before any deployment.
set -euo pipefail
requested="${1:?mode required}"
case "$requested" in preserve|off|collect|stage|active) ;; *) exit 1 ;; esac
: "${SOURCE_PATH:?}"
read_target() {
  local key="$1" remote="$2" path="$3" app="$4" name="$5"
  ssh -i "$key" -o BatchMode=yes -o ConnectTimeout=10 "$remote" \
    "TARGET_PATH='$path' APP_SERVICE='$app' TARGET_NAME='$name' bash -s" \
    < "$SOURCE_PATH/.github/scripts/attest-activity-target.sh"
}
cloud=$(read_target /home/rtrda-dgt/.ssh/rtrda-cloud-preprod-sync_ed25519 ubuntu@100.77.64.92 /home/ubuntu/rtrda-preprod/web-app-rtrda web-app-rtrda-preprod-cloud cloud)
fallback=$(read_target /home/rtrda-dgt/.ssh/rtrda02_prod_preview_sync_ed25519 rtrda@100.91.174.121 /srv/apps/web-app-rtrda-preprod-rtrda02 web-app-rtrda-preprod-rtrda02 rtrda02)
previous=$(python3 - "$cloud" "$fallback" <<'PY'
import json, sys
cloud, fallback = (json.loads(s) for s in sys.argv[1:])
if cloud['mode'] != fallback['mode']: raise SystemExit('production activity mode mismatch')
print(cloud['mode'])
PY
)
if [ "$requested" = preserve ]; then printf '%s\n' "$previous"; else printf '%s\n' "$requested"; fi
