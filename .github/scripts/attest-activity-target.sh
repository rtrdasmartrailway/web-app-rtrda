#!/usr/bin/env bash
# Read-only target attestation. Prints only bounded mode/image/health metadata.
set -euo pipefail
: "${TARGET_PATH:?}"
: "${APP_SERVICE:?}"
: "${TARGET_NAME:?}"
cd "$TARGET_PATH"
python3 - "$APP_SERVICE" "$TARGET_NAME" <<'PY'
import json, pathlib, subprocess, sys
app, target = sys.argv[1:]
overlay = pathlib.Path('.deploy-state/activity-overlay.yml')
text = overlay.read_text() if overlay.exists() else ''
if not text: mode = 'off'
elif 'ACTIVITY_LOGGING_ENABLED: "true"' in text and 'ACTIVITY_RETENTION_ENABLED: "true"' in text: mode = 'active'
elif 'ACTIVITY_LOGGING_ENABLED: "false"' in text and 'ACTIVITY_RETENTION_ENABLED: "false"' in text: mode = 'stage'
else: raise SystemExit('invalid overlay mode')
def inspect(name):
    result = subprocess.run(['docker', 'inspect', name], capture_output=True, text=True)
    if result.returncode: raise SystemExit('missing container')
    return json.loads(result.stdout)[0]
compose = ['docker', 'compose', '--env-file', '.env.cicd-preprod' if pathlib.Path('.env.cicd-preprod').exists() else '.env', '-f', f'docker-compose.preprod-{target}.yml']
if overlay.exists(): compose += ['-f', str(overlay)]
def service(name):
    identifier = subprocess.check_output(compose + ['ps', '-q', name], text=True).strip()
    if not identifier: raise SystemExit('missing service')
    return inspect(identifier)
container = service(app)
env = dict(line.split('=', 1) for line in container['Config']['Env'] if '=' in line)
logging = env.get('ACTIVITY_LOGGING_ENABLED', 'false')
retention = env.get('ACTIVITY_RETENTION_ENABLED', 'false')
if logging != ('true' if mode == 'active' else 'false') or retention != logging:
    raise SystemExit('runtime mode mismatch')
if mode != 'off' and (env.get('ACTIVITY_RECORDING_HOST') != target or env.get('ANALYTICS_HASH_SALT_FILE') != '/run/secrets/analytics-salt.env'):
    raise SystemExit('runtime host or protected file mismatch')
def protected_mount(info, service_name, source_name, destination):
    expected_source = str(pathlib.Path.cwd() / '.activity-secrets' / source_name)
    mounts = [mount for mount in info.get('Mounts', []) if mount.get('Destination') == destination]
    if len(mounts) != 1 or mounts[0].get('Type') != 'bind' or mounts[0].get('Source') != expected_source or mounts[0].get('RW') is not False:
        raise SystemExit('protected mount mismatch')
    result = subprocess.run(compose + ['exec', '-T', service_name, 'test', '-r', destination], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if result.returncode: raise SystemExit('protected file unreadable')
if mode != 'off': protected_mount(container, app, 'analytics-salt.env', '/run/secrets/analytics-salt.env')
image = container['Config']['Image']
health = container['State'].get('Health', {}).get('Status')
if health != 'healthy': raise SystemExit('app unhealthy')
auth_image = None
if mode != 'off':
    auth = service('activity-report-auth')
    if auth['State'].get('Health', {}).get('Status') != 'healthy': raise SystemExit('auth unhealthy')
    auth_env = dict(line.split('=', 1) for line in auth['Config']['Env'] if '=' in line)
    if auth_env.get('ACTIVITY_OIDC_FILE') != '/run/secrets/activity-oidc.env': raise SystemExit('auth file mismatch')
    protected_mount(auth, 'activity-report-auth', 'oidc.env', '/run/secrets/activity-oidc.env')
    auth_image = auth['Config']['Image']
print(json.dumps(dict(mode=mode, host=target, image=image, authImage=auth_image, health=health,
                      sha=pathlib.Path('.deploy-state/preprod-release').read_text().strip() if pathlib.Path('.deploy-state/preprod-release').exists() else None,
                      checkout=subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()), sort_keys=True))
PY
