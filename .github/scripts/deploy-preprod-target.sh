#!/usr/bin/env bash
set -euo pipefail

: "${TARGET_NAME:?TARGET_NAME required}"
: "${TARGET_HOST:?TARGET_HOST required}"
: "${TARGET_USER:?TARGET_USER required}"
: "${TARGET_PATH:?TARGET_PATH required}"
: "${SSH_KEY:?SSH_KEY required}"
: "${COMPOSE_FILE:?COMPOSE_FILE required}"
: "${APP_SERVICE:?APP_SERVICE required}"
: "${DB_SERVICE:?DB_SERVICE required}"
: "${DB_HOST_PORT:?DB_HOST_PORT required}"
: "${DIRECT_HEALTH_URL:?DIRECT_HEALTH_URL required}"
: "${GITHUB_SHA:?GITHUB_SHA required}"

SSH_OPTS=(-i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)
REMOTE="${TARGET_USER}@${TARGET_HOST}"

cd /srv/workspace/web-app-rtrda

echo "== ${TARGET_NAME}: sync mirrored public assets =="
rsync -az --delete --info=stats2 -e "ssh ${SSH_OPTS[*]}" \
  public/wp-content/uploads/ "${REMOTE}:${TARGET_PATH}/public/wp-content/uploads/"
rsync -az --delete --info=stats2 -e "ssh ${SSH_OPTS[*]}" \
  public/sdc-downloads/ "${REMOTE}:${TARGET_PATH}/public/sdc-downloads/"

echo "== ${TARGET_NAME}: deploy ${GITHUB_SHA} =="
ssh "${SSH_OPTS[@]}" "$REMOTE" \
  "TARGET_NAME='$TARGET_NAME' TARGET_PATH='$TARGET_PATH' COMPOSE_FILE='$COMPOSE_FILE' APP_SERVICE='$APP_SERVICE' DB_SERVICE='$DB_SERVICE' DB_HOST_PORT='$DB_HOST_PORT' DIRECT_HEALTH_URL='$DIRECT_HEALTH_URL' DEPLOY_SHA='$GITHUB_SHA' bash -s" <<'REMOTE_DEPLOY'
set -euo pipefail
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

# Preserve per-host, untracked compose file but tag the image with the exact deployed SHA.
python3 - <<PY
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
for line in Path('.env').read_text(errors='ignore').splitlines():
    if line.startswith('POSTGRES_PASSWORD='):
        print(line.split('=',1)[1].strip().strip('"').strip("'"))
        break
PY
)"
if [ -z "$PGPASS_VALUE" ]; then
  echo "::error::database password not found in ${TARGET_PATH}/.env"
  exit 1
fi
cat > .env.cicd-preprod <<EOF
POSTGRES_PASSWORD=${PGPASS_VALUE}
DATABASE_URL=postgresql://rtrda:${PGPASS_VALUE}@127.0.0.1:${DB_HOST_PORT}/rtrda
SITE_ORIGIN=https://pre-prod.rtrda.or.th
NODE_ENV=production
EOF
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
REMOTE_DEPLOY
