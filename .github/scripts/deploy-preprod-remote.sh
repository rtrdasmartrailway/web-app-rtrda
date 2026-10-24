#!/usr/bin/env bash
set -Eeuo pipefail

: "${TARGET_NAME:?TARGET_NAME required}"
: "${TARGET_PATH:?TARGET_PATH required}"
: "${COMPOSE_FILE:?COMPOSE_FILE required}"
: "${APP_SERVICE:?APP_SERVICE required}"
: "${DB_SERVICE:?DB_SERVICE required}"
: "${DB_HOST_PORT:?DB_HOST_PORT required}"
: "${DIRECT_HEALTH_URL:?DIRECT_HEALTH_URL required}"
: "${DEPLOY_SHA:?DEPLOY_SHA required}"

cd "$TARGET_PATH"

if [ ! -d .git ]; then
  echo "::error::${TARGET_PATH} is not a git checkout"
  exit 1
fi
if [ ! -f "$COMPOSE_FILE" ]; then
  echo "::error::missing compose file ${TARGET_PATH}/${COMPOSE_FILE}"
  exit 1
fi

mkdir -p .deploy-state
ACTIVITY_DEPLOY_MODE="${ACTIVITY_DEPLOY_MODE:-off}"
ACTIVITY_RELEASE_SHA="$DEPLOY_SHA"
export ACTIVITY_DEPLOY_MODE ACTIVITY_RELEASE_SHA
ACTIVITY_OVERLAY=".deploy-state/activity-overlay.yml"
PREVIOUS_OVERLAY=".deploy-state/previous-activity-overlay.yml"
if [ -f "$ACTIVITY_OVERLAY" ]; then cp "$ACTIVITY_OVERLAY" "$PREVIOUS_OVERLAY"; else rm -f "$PREVIOUS_OVERLAY"; fi
# The two independent protected sources live only on each target, outside Git.
ACTIVITY_OIDC_ENV_FILE="$TARGET_PATH/.activity-secrets/oidc.env"
ACTIVITY_SALT_ENV_FILE="$TARGET_PATH/.activity-secrets/analytics-salt.env"
export ACTIVITY_OIDC_ENV_FILE ACTIVITY_SALT_ENV_FILE
PREVIOUS_SHA=""
PREVIOUS_RELEASE_KNOWN=false
PREVIOUS_COMPOSE=".deploy-state/previous-compose.yml"
PREVIOUS_ENV=".deploy-state/previous-env"
PREVIOUS_CICD_ENV=".deploy-state/previous-cicd-env"
for pair in ".env:$PREVIOUS_ENV" ".env.cicd-preprod:$PREVIOUS_CICD_ENV"; do
  source_file="${pair%%:*}"; snapshot="${pair#*:}"
  if [ -f "$source_file" ]; then cp -p "$source_file" "$snapshot"; else rm -f "$snapshot"; fi
done
if [ -f .deploy-state/preprod-release ]; then
  PREVIOUS_SHA="$(tr -d '[:space:]' < .deploy-state/preprod-release)"
  if [ -n "$PREVIOUS_SHA" ]; then PREVIOUS_RELEASE_KNOWN=true; fi
fi
if [ -z "$PREVIOUS_SHA" ]; then PREVIOUS_SHA="$(git rev-parse HEAD)"; fi
if ! git cat-file -e "${PREVIOUS_SHA}^{commit}" 2>/dev/null; then
  echo '::error::previous checkout unavailable for rollback' >&2
  exit 1
fi
cp "$COMPOSE_FILE" "$PREVIOUS_COMPOSE"
COMPOSE_ARGS=(--env-file .env.cicd-preprod -f "$COMPOSE_FILE")

wait_for_health() {
  local attempts="${1:-50}"
  for attempt in $(seq 1 "$attempts"); do
    if curl -fsS "$DIRECT_HEALTH_URL"; then
      echo
      return 0
    fi
    sleep 3
  done
  return 1
}

rollback_activity_overlay() {
  if [ -f "$ACTIVITY_OVERLAY" ] && grep -q '^  activity-report-auth:' "$ACTIVITY_OVERLAY" && { [ ! -f "$PREVIOUS_OVERLAY" ] || ! grep -q '^  activity-report-auth:' "$PREVIOUS_OVERLAY"; }; then
    # Remove only the new private service; never tear down the database/network.
    docker compose "${COMPOSE_ARGS[@]}" rm -sf activity-report-auth || true
  fi
  if [ -f "$PREVIOUS_OVERLAY" ]; then
    cp "$PREVIOUS_OVERLAY" "$ACTIVITY_OVERLAY"
    COMPOSE_ARGS=(--env-file .env.cicd-preprod -f "$COMPOSE_FILE" -f "$ACTIVITY_OVERLAY")
  else
    rm -f "$ACTIVITY_OVERLAY"
    COMPOSE_ARGS=(--env-file .env.cicd-preprod -f "$COMPOSE_FILE")
  fi
}

rollback_previous_release() {
  trap - ERR
  if [ -z "$PREVIOUS_SHA" ] || [ ! -f "$PREVIOUS_COMPOSE" ]; then
    echo "::error::no previous release is available for rollback"
    return 1
  fi

  echo "::warning::${TARGET_NAME}: rolling back to ${PREVIOUS_SHA}"
  git checkout -f -B preprod "$PREVIOUS_SHA"
  git reset --hard "$PREVIOUS_SHA"
  cp "$PREVIOUS_COMPOSE" "$COMPOSE_FILE"
  for pair in ".env:$PREVIOUS_ENV" ".env.cicd-preprod:$PREVIOUS_CICD_ENV"; do
    destination="${pair%%:*}"; snapshot="${pair#*:}"
    if [ -f "$snapshot" ]; then cp -p "$snapshot" "$destination"; else rm -f "$destination"; fi
  done
  rollback_activity_overlay
  if [ -f "$ACTIVITY_OVERLAY" ] && grep -q '^  activity-report-auth:' "$ACTIVITY_OVERLAY" && { [ "${AUTH_SWAP_STARTED:-false}" = true ] || [ "${APP_SWAP_STARTED:-false}" = true ]; }; then
    docker compose "${COMPOSE_ARGS[@]}" up -d --no-build activity-report-auth
  fi
  if [ "${APP_SWAP_STARTED:-false}" = true ]; then
    docker compose "${COMPOSE_ARGS[@]}" up -d --no-build "$APP_SERVICE"
  fi
  if wait_for_health 30; then
    echo "::warning::${TARGET_NAME}: restored previous healthy release ${PREVIOUS_SHA}"
    return 0
  fi

  echo "::error::${TARGET_NAME}: rollback health check failed"
  return 1
}

# Errors from checkout, dependency install, migrations and seed restore checkout/container state only.
# Database migrations and destructive seed changes are NOT automatically reversed.
on_deploy_failure() {
  trap - ERR
  rollback_previous_release || true
  exit 1
}
trap on_deploy_failure ERR
python3 "${ACTIVITY_OVERLAY_SCRIPT:?activity overlay generator required}" "$TARGET_NAME" "$APP_SERVICE" "$DB_SERVICE" "$COMPOSE_FILE" "$ACTIVITY_OVERLAY"
git fetch origin test main --prune
git checkout -f -B preprod "$DEPLOY_SHA"
git reset --hard "$DEPLOY_SHA"

python3 - <<'PY'
from pathlib import Path
import os, re
p = Path(os.environ['COMPOSE_FILE'])
s = p.read_text()
target = os.environ['TARGET_NAME']
sha = os.environ['DEPLOY_SHA']
if target == 'cloud':
    s = re.sub(r'image: web-app-rtrda:preprod-cloud-[A-Za-z0-9._-]+', f'image: web-app-rtrda:preprod-cloud-{sha}', s)
elif target == 'rtrda02':
    s = re.sub(r'image: web-app-rtrda:preprod-rtrda02-[A-Za-z0-9._-]+', f'image: web-app-rtrda:preprod-rtrda02-{sha}', s)
p.write_text(s)
PY

PGPASS_VALUE="$(python3 - <<'PY'
from pathlib import Path
key = 'POSTGRES' + '_PASSWORD'
for line in Path('.env').read_text(errors='ignore').splitlines():
    if '=' not in line:
        continue
    k, v = line.split('=', 1)
    if k == key:
        print(v.strip().strip('"').strip("'"))
        break
PY
)"
if [ -z "$PGPASS_VALUE" ]; then
  echo "::error::database password not found in ${TARGET_PATH}/.env"
  on_deploy_failure
fi
{
  printf '%s=%s\n' 'POSTGRES_PASSWORD' "$PGPASS_VALUE"
  printf 'DATABASE_URL=postgresql://rtrda:%s@127.0.0.1:%s/rtrda\n' "$PGPASS_VALUE" "$DB_HOST_PORT"
  printf 'SITE_ORIGIN=https://pre-prod.rtrda.or.th\n'
  printf 'NODE_ENV=production\n'
} > .env.cicd-preprod
chmod 600 .env.cicd-preprod
cp .env.cicd-preprod .env

COMPOSE_ARGS=(--env-file .env.cicd-preprod -f "$COMPOSE_FILE")
if [ -f "$ACTIVITY_OVERLAY" ]; then COMPOSE_ARGS+=(-f "$ACTIVITY_OVERLAY"); fi
# Do not dump config: Compose includes other database environment values.
docker compose "${COMPOSE_ARGS[@]}" config --quiet

run_node() {
  if command -v npm >/dev/null 2>&1; then
    "$@"
  else
    docker run --rm --network host \
      --user "$(id -u):$(id -g)" \
      -e npm_config_cache=/tmp/npm-cache \
      -v "$PWD:/app" \
      -w /app \
      node:22-bookworm-slim \
      bash -lc "$*"
  fi
}

run_node npm ci
run_node npx prisma generate

docker compose --env-file .env.cicd-preprod -f "$COMPOSE_FILE" up -d "$DB_SERVICE"
for attempt in $(seq 1 40); do
  if docker compose --env-file .env.cicd-preprod -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" pg_isready -U rtrda -d rtrda >/dev/null 2>&1; then
    break
  fi
  sleep 2
  if [ "$attempt" = 40 ]; then
    docker compose --env-file .env.cicd-preprod -f "$COMPOSE_FILE" ps
    on_deploy_failure
  fi
done

seed_required() {
  # Compare the frozen manifest bytes, not a tree/SHA approximation. An absent
  # prior release or unreadable prior blob falls back to the existing seed path.
  [ "$PREVIOUS_RELEASE_KNOWN" != true ] ||
    ! git show "${PREVIOUS_SHA}:src/data/wp-content.json" | cmp -s - src/data/wp-content.json
}
run_node npm run db:migrate
if seed_required; then
  # A changed manifest still runs the destructive seed. Before Production
  # promotion require a protected DB backup and verified rollback gate: source
  # checkout rollback does NOT restore truncated content tables.
  run_node npm run db:seed
else
  echo "${TARGET_NAME}: frozen content manifest unchanged; skipping db:seed"
fi

# Build SHA-tagged images while the old container remains up.
if [ -f "$ACTIVITY_OVERLAY" ] && grep -q '^  activity-report-auth:' "$ACTIVITY_OVERLAY"; then
  if ! docker compose "${COMPOSE_ARGS[@]}" build activity-report-auth; then
    rollback_previous_release || true
    exit 1
  fi
fi
if ! docker compose "${COMPOSE_ARGS[@]}" build "$APP_SERVICE"; then
  rollback_previous_release || true
  exit 1
fi
# The dependency must become healthy before replacement; /session without a
# signed-in cookie must deny access. No host port is published for the API.
if [ -f "$ACTIVITY_OVERLAY" ] && grep -q '^  activity-report-auth:' "$ACTIVITY_OVERLAY"; then
  AUTH_SWAP_STARTED=true
  if ! docker compose "${COMPOSE_ARGS[@]}" up -d --no-build activity-report-auth; then
    rollback_previous_release || true
    exit 1
  fi
  auth_denies_anonymous=false
  for attempt in $(seq 1 20); do
    if docker compose "${COMPOSE_ARGS[@]}" exec -T activity-report-auth node -e "fetch('http://127.0.0.1:3101/session').then(r=>process.exit(r.status===401?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
      auth_denies_anonymous=true
      break
    fi
    sleep 2
  done
  if [ "$auth_denies_anonymous" != true ]; then
    rollback_previous_release || true
    exit 1
  fi
fi
# Replacement is now a short container swap; never rebuild while the old service is stopped.
APP_SWAP_STARTED=true
if ! docker compose "${COMPOSE_ARGS[@]}" up -d --no-build "$APP_SERVICE"; then
  echo "::error::${TARGET_NAME}: container replacement command failed"
  rollback_previous_release || true
  exit 1
fi

if [ -f "$ACTIVITY_OVERLAY" ] && ! docker compose "${COMPOSE_ARGS[@]}" exec -T "$APP_SERVICE" test -r /run/secrets/analytics-salt.env; then
  echo "::error::${TARGET_NAME}: protected salt unreadable by app runner" >&2
  rollback_previous_release || true
  exit 1
fi
if wait_for_health 50; then
  if { [ ! -f "$ACTIVITY_OVERLAY" ] || ! grep -q '^  activity-report-auth:' "$ACTIVITY_OVERLAY"; } && [ -f "$PREVIOUS_OVERLAY" ] && grep -q '^  activity-report-auth:' "$PREVIOUS_OVERLAY"; then
    if ! docker compose --env-file .env.cicd-preprod -f "$COMPOSE_FILE" -f "$PREVIOUS_OVERLAY" rm -sf activity-report-auth; then
      rollback_previous_release || true
      exit 1
    fi
  fi
  echo "$DEPLOY_SHA" > .deploy-state/preprod-release
  printf '%s %s %s\n' "$(date -Is)" "$TARGET_NAME" "$DEPLOY_SHA" >> .deploy-state/preprod-releases.log
  rm -f "$PREVIOUS_COMPOSE" "$PREVIOUS_ENV" "$PREVIOUS_CICD_ENV" "$PREVIOUS_OVERLAY"
  trap - ERR
  exit 0
fi

docker compose --env-file .env.cicd-preprod -f "$COMPOSE_FILE" ps
docker compose --env-file .env.cicd-preprod -f "$COMPOSE_FILE" logs --tail=160 "$APP_SERVICE"
rollback_previous_release || true
exit 1
