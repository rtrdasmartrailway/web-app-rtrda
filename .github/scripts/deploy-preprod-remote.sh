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

git fetch origin test main --prune
git checkout -B preprod "$DEPLOY_SHA"
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

docker compose --env-file .env.cicd-preprod -f "$COMPOSE_FILE" up -d --build "$APP_SERVICE"
mkdir -p .deploy-state
echo "$DEPLOY_SHA" > .deploy-state/preprod-release
printf '%s %s %s\n' "$(date -Is)" "$TARGET_NAME" "$DEPLOY_SHA" >> .deploy-state/preprod-releases.log

for attempt in $(seq 1 50); do
  if curl -fsS "$DIRECT_HEALTH_URL"; then
    echo
    exit 0
  fi
  sleep 3
done

docker compose --env-file .env.cicd-preprod -f "$COMPOSE_FILE" ps
docker compose --env-file .env.cicd-preprod -f "$COMPOSE_FILE" logs --tail=160 "$APP_SERVICE"
exit 1
