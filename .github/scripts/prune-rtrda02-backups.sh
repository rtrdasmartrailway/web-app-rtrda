#!/usr/bin/env bash
set -euo pipefail

: "${TARGET_PATH:?TARGET_PATH required}"
BACKUP_ROOT="${BACKUP_ROOT:-$TARGET_PATH/.release-backups}"
RETENTION_COUNT=3

python3 - "$TARGET_PATH" "$BACKUP_ROOT" <<'PY'
import os, sys
_target, root = map(os.path.realpath, sys.argv[1:])
allowed = os.path.realpath(os.path.join(_target, ".release-backups"))
if root != allowed and root != "/srv/backups/rtrda-web" and not root.startswith("/srv/backups/rtrda-web/"):
    raise SystemExit("backup root is outside an approved RTRDA02 path")
PY

test -d "$BACKUP_ROOT"
mapfile -t backups < <(
  python3 - "$BACKUP_ROOT" <<'PY'
import os, sys
root = sys.argv[1]
paths = [os.path.join(root, name) for name in os.listdir(root)]
for path in sorted(paths, key=os.path.getmtime, reverse=True):
    complete = os.path.isfile(os.path.join(path, "release-manifest.json")) and os.path.isfile(os.path.join(path, "SHA256SUMS")) and os.path.isfile(os.path.join(path, "RELEASE_SUCCESS"))
    if os.path.isdir(path) and complete:
        print(path)
PY
)
test "${#backups[@]}" -gt 0
newest="${backups[0]}"
newest_mtime="$(stat -c %Y "$newest")"
mapfile -t incomplete < <(
  python3 - "$BACKUP_ROOT" "$newest_mtime" <<'PY'
import os, sys
root, cutoff = sys.argv[1], int(sys.argv[2])
for name in os.listdir(root):
    path = os.path.join(root, name)
    if not os.path.isdir(path):
        continue
    complete = os.path.isfile(os.path.join(path, "release-manifest.json")) and os.path.isfile(os.path.join(path, "SHA256SUMS")) and os.path.isfile(os.path.join(path, "RELEASE_SUCCESS"))
    if not complete and os.path.getmtime(path) < cutoff:
        print(path)
PY
)
for old in "${incomplete[@]}"; do
  test "$old" != "$newest"
  rm -rf -- "$old"
done
if [ "${#backups[@]}" -le "$RETENTION_COUNT" ]; then
  exit 0
fi
for old in "${backups[@]:$RETENTION_COUNT}"; do
  test "$old" != "$newest"
  test -s "$old/release-manifest.json"
  test -s "$old/SHA256SUMS"
  rm -rf -- "$old"
done
