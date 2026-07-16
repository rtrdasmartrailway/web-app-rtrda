#!/usr/bin/env bash
set -euo pipefail

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
PREVIOUS_SHA=""
PREVIOUS_COMPOSE="/tmp/rtrda-${TARGET_NAME}-previous-compose.yml"
if [ -f .deploy-state/preprod-release ]; then
  PREVIOUS_SHA="$(tr -d '[:space:]' < .deploy-state/preprod-release)"
fi
if [ -n "$PREVIOUS_SHA" ] && git cat-file -e "${PREVIOUS_SHA}^{commit}" 2>/dev/null; then
  cp "$COMPOSE_FILE" "$PREVIOUS_COMPOSE"
else
  PREVIOUS_SHA=""
  rm -f "$PREVIOUS_COMPOSE"
fi

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
  exit 1
fi
{
  printf '%s=%s\n' 'POSTGRES_PASSWORD' "$PGPASS_VALUE"
  printf 'DATABASE_URL=postgresql://rtrda:%s@127.0.0.1:%s/rtrda\n' "$PGPASS_VALUE" "$DB_HOST_PORT"
  printf 'SITE_ORIGIN=https://pre-prod.rtrda.or.th\n'
  printf 'NODE_ENV=production\n'
} > .env.cicd-preprod
chmod 600 .env.cicd-preprod
cp .env.cicd-preprod .env

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
    exit 1
  fi
done

run_node npm run db:migrate
run_node npm run db:seed

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

rollback_previous_release() {
  if [ -z "$PREVIOUS_SHA" ] || [ ! -f "$PREVIOUS_COMPOSE" ]; then
    echo "::error::no previous release is available for rollback"
    return 1
  fi

  echo "::warning::${TARGET_NAME}: rolling back to ${PREVIOUS_SHA}"
  git checkout -f -B preprod "$PREVIOUS_SHA"
  git reset --hard "$PREVIOUS_SHA"
  cp "$PREVIOUS_COMPOSE" "$COMPOSE_FILE"
  docker compose --env-file .env.cicd-preprod -f "$COMPOSE_FILE" up -d --no-build "$APP_SERVICE"
  if wait_for_health 30; then
    echo "::warning::${TARGET_NAME}: restored previous healthy release ${PREVIOUS_SHA}"
    return 0
  fi

  echo "::error::${TARGET_NAME}: rollback health check failed"
  return 1
}

# Build the immutable SHA-tagged image while the current container remains up.
docker compose --env-file .env.cicd-preprod -f "$COMPOSE_FILE" build "$APP_SERVICE"
# Replacement is now a short container swap; never rebuild while the old service is stopped.
if ! docker compose --env-file .env.cicd-preprod -f "$COMPOSE_FILE" up -d --no-build "$APP_SERVICE"; then
  echo "::error::${TARGET_NAME}: container replacement command failed"
  rollback_previous_release || true
  exit 1
fi

if wait_for_health 50; then
  echo "$DEPLOY_SHA" > .deploy-state/preprod-release
  printf '%s %s %s\n' "$(date -Is)" "$TARGET_NAME" "$DEPLOY_SHA" >> .deploy-state/preprod-releases.log
  rm -f "$PREVIOUS_COMPOSE"
  exit 0
fi

docker compose --env-file .env.cicd-preprod -f "$COMPOSE_FILE" ps
docker compose --env-file .env.cicd-preprod -f "$COMPOSE_FILE" logs --tail=160 "$APP_SERVICE"
rollback_previous_release || true
exit 1
