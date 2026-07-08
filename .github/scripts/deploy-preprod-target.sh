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
REMOTE_SCRIPT="/tmp/rtrda-deploy-preprod-remote-${TARGET_NAME}.sh"

SOURCE_PATH="${SOURCE_PATH:-/srv/workspace/web-app-rtrda}"
cd "$SOURCE_PATH"

echo "== ${TARGET_NAME}: sync mirrored public assets =="
# Preserve legacy WordPress-mirrored files that are present in the host-mounted
# production asset tree but intentionally ignored by Git. A clean CI checkout
# must add/update files without deleting valid existing production images/PDFs.
rsync -az --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r --info=stats2 -e "ssh ${SSH_OPTS[*]}" \
  public/wp-content/uploads/ "${REMOTE}:${TARGET_PATH}/public/wp-content/uploads/"
rsync -az --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r --info=stats2 -e "ssh ${SSH_OPTS[*]}" \
  public/sdc-downloads/ "${REMOTE}:${TARGET_PATH}/public/sdc-downloads/"

echo "== ${TARGET_NAME}: deploy ${GITHUB_SHA} =="
rsync -az -e "ssh ${SSH_OPTS[*]}" \
  .github/scripts/deploy-preprod-remote.sh "${REMOTE}:${REMOTE_SCRIPT}"
ssh "${SSH_OPTS[@]}" "$REMOTE" \
  "chmod +x '$REMOTE_SCRIPT' && TARGET_NAME='$TARGET_NAME' TARGET_PATH='$TARGET_PATH' COMPOSE_FILE='$COMPOSE_FILE' APP_SERVICE='$APP_SERVICE' DB_SERVICE='$DB_SERVICE' DB_HOST_PORT='$DB_HOST_PORT' DIRECT_HEALTH_URL='$DIRECT_HEALTH_URL' DEPLOY_SHA='$GITHUB_SHA' '$REMOTE_SCRIPT'"
