#!/usr/bin/env bash
set -euo pipefail

: "${TARGET_PATH:?TARGET_PATH required}"
: "${COMPOSE_FILE:?COMPOSE_FILE required}"
: "${APP_SERVICE:?APP_SERVICE required}"
: "${DB_SERVICE:?DB_SERVICE required}"
: "${SOURCE_SHA:?SOURCE_SHA required}"
: "${TARGET_SHA:?TARGET_SHA required}"

test "${#SOURCE_SHA}" -eq 40
test "${#TARGET_SHA}" -eq 40
case "$SOURCE_SHA$TARGET_SHA" in
  *[!0-9a-f]*) echo "::error::release SHAs must be lowercase hexadecimal" >&2; exit 1 ;;
esac

cd "$TARGET_PATH"
test -d .git
test -f "$COMPOSE_FILE"
test -f .deploy-state/preprod-release
LIVE_SHA="$(tr -d '[:space:]' < .deploy-state/preprod-release)"
test "$LIVE_SHA" = "$SOURCE_SHA"

BACKUP_ROOT="${BACKUP_ROOT:-$TARGET_PATH/.release-backups}"
RETENTION_COUNT=3
MIN_FREE_KB="${MIN_FREE_KB:-1048576}"
python3 - "$TARGET_PATH" "$BACKUP_ROOT" <<'PY'
import os, sys
_target, root = map(os.path.realpath, sys.argv[1:])
allowed = os.path.realpath(os.path.join(_target, ".release-backups"))
if root != allowed and not root.startswith("/srv/backups/rtrda-web/") and root != "/srv/backups/rtrda-web":
    raise SystemExit("backup root is outside an approved RTRDA02 path")
PY
mkdir -p "$BACKUP_ROOT"
TARGET_DEVICE="$(stat -c %d "$TARGET_PATH")"
BACKUP_DEVICE="$(stat -c %d "$BACKUP_ROOT")"
if [ "$TARGET_DEVICE" != "$BACKUP_DEVICE" ]; then
  echo "::error::hard-link backup root must share the Production filesystem" >&2
  exit 1
fi
FREE_KB="$(df -Pk "$BACKUP_ROOT" | python3 -c 'import sys; print(sys.stdin.read().splitlines()[-1].split()[3])')"
test "$FREE_KB" -ge "$MIN_FREE_KB"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="$BACKUP_ROOT/${STAMP}-${SOURCE_SHA}-to-${TARGET_SHA}"
mkdir "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

ENV_FILE=.env.cicd-preprod
test -f "$ENV_FILE" || ENV_FILE=.env
test -f "$ENV_FILE"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
"${COMPOSE[@]}" exec -T "$DB_SERVICE" pg_isready -U rtrda -d rtrda >/dev/null
"${COMPOSE[@]}" exec -T "$DB_SERVICE" pg_dump -U rtrda -d rtrda -Fc > "$BACKUP_DIR/database.dump"
test -s "$BACKUP_DIR/database.dump"
"${COMPOSE[@]}" exec -T "$DB_SERVICE" pg_restore --list < "$BACKUP_DIR/database.dump" >/dev/null

mkdir -p "$BACKUP_DIR/public/wp-content"
cp -al public/wp-content/uploads "$BACKUP_DIR/public/wp-content/uploads"
cp -al public/sdc-downloads "$BACKUP_DIR/public/sdc-downloads"
(
  cd "$BACKUP_DIR"
  find public -type f -print0 | sort -z | xargs -0 sha256sum > public-assets.SHA256SUMS
  test -s public-assets.SHA256SUMS
  sha256sum -c public-assets.SHA256SUMS >/dev/null
)
cp "$COMPOSE_FILE" "$BACKUP_DIR/compose.yml"
if [ -f .deploy-state/activity-overlay.yml ]; then
  cp .deploy-state/activity-overlay.yml "$BACKUP_DIR/activity-overlay.yml"
  if grep -q 'ACTIVITY_LOGGING_ENABLED: "true"' "$BACKUP_DIR/activity-overlay.yml"; then
    if grep -q '^  activity-report-auth:' "$BACKUP_DIR/activity-overlay.yml"; then ACTIVITY_MODE=active; else ACTIVITY_MODE=collect; fi
  elif grep -q 'ACTIVITY_LOGGING_ENABLED: "false"' "$BACKUP_DIR/activity-overlay.yml"; then
    ACTIVITY_MODE=stage
  else
    echo '::error::invalid activity overlay mode' >&2; exit 1
  fi
else
  ACTIVITY_MODE=off
fi

CONTAINER_ID="$("${COMPOSE[@]}" ps -q "$APP_SERVICE")"
test -n "$CONTAINER_ID"
IMAGE_ID="$(docker inspect "$CONTAINER_ID" --format '{{.Image}}')"
IMAGE_REF="$(docker inspect "$CONTAINER_ID" --format '{{.Config.Image}}')"
REVISION="$(docker inspect "$CONTAINER_ID" --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}')"
if [ -z "$REVISION" ] || [ "$REVISION" = "<no value>" ]; then
  case "$IMAGE_REF" in
    *"-$SOURCE_SHA") REVISION="$SOURCE_SHA" ;;
    *) echo "::error::image reference is not bound to source Production SHA" >&2; exit 1 ;;
  esac
fi
test "$REVISION" = "$SOURCE_SHA"

python3 - "$BACKUP_DIR/release-manifest.json" "$SOURCE_SHA" "$TARGET_SHA" "$STAMP" "$IMAGE_ID" "$IMAGE_REF" "$REVISION" "$ACTIVITY_MODE" <<'PY'
import json, os, sys
path, source, target, stamp, image_id, image_ref, revision, activity_mode = sys.argv[1:]
artifacts = ["database.dump", "compose.yml", "public-assets.SHA256SUMS"]
overlay = os.path.join(os.path.dirname(path), "activity-overlay.yml")
if os.path.isfile(overlay): artifacts.append("activity-overlay.yml")
manifest = {
    "schemaVersion": 1,
    "sourceProductionSha": source,
    "targetCandidateSha": target,
    "createdAtUtc": stamp,
    "imageId": image_id,
    "imageRef": image_ref,
    "imageRevision": revision,
    "assetSnapshot": "public",
    "activityMode": activity_mode,
    "overlaySha256": __import__("hashlib").sha256(open(overlay, "rb").read()).hexdigest() if os.path.isfile(overlay) else None,
    "artifacts": [{"name": name, "size": os.path.getsize(os.path.join(os.path.dirname(path), name))} for name in artifacts],
}
with open(path, "w", encoding="utf-8") as fh:
    json.dump(manifest, fh, sort_keys=True, indent=2)
    fh.write("\n")
PY

(
  cd "$BACKUP_DIR"
  files=(database.dump compose.yml public-assets.SHA256SUMS release-manifest.json)
  if [ -f activity-overlay.yml ]; then files+=(activity-overlay.yml); fi
  sha256sum "${files[@]}" > SHA256SUMS
  sha256sum -c SHA256SUMS >/dev/null
)

# Retention cleanup is intentionally not part of the pre-deploy critical path.
# RETENTION_COUNT=3 is enforced only by a separate post-success maintenance run.
printf '%s\n' "$BACKUP_DIR"
