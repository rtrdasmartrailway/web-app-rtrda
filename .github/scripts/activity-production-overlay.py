#!/usr/bin/env python3
"""Fail-closed, target-bound private Compose overlay. Never print protected values."""
import os
from pathlib import Path
import re
import stat
import sys

CALLBACK = 'https://rtrda.or.th/api/analytics/activity-auth/callback'
KEYS = ('ACTIVITY_OIDC_TENANT_ID', 'ACTIVITY_OIDC_CLIENT_ID', 'ACTIVITY_OIDC_CLIENT_SECRET', 'ACTIVITY_OIDC_ISSUER', 'ACTIVITY_OIDC_REDIRECT_URI')


def protected_metadata(path):
    info = path.lstat()  # refuse symlinks (including directory components below)
    if not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode) != 0o600:
        raise ValueError('protected source must be a regular 0600 file')
    if any(part.is_symlink() for part in list(path.parents)[:-1]):
        raise ValueError('protected parent must not be a symlink')
    return info


def protected(path, keys):
    protected_metadata(path)
    values = {}
    for line in path.read_text().splitlines():
        if not line or line.startswith('#'):
            continue
        key, sep, value = line.partition('=')
        if not sep or key not in keys or key in values or not re.fullmatch(r'[A-Za-z0-9_./:@-]+', value):
            raise ValueError('invalid protected source syntax')
        values[key] = value
    if set(values) != set(keys):
        raise ValueError('missing protected source key')
    return values


def main():
    target, app, db, base, output = sys.argv[1:]
    mode = os.environ.get('ACTIVITY_DEPLOY_MODE', 'off')
    if mode not in ('off', 'collect', 'stage', 'active'):
        raise ValueError('invalid activity deployment mode')
    output = Path(output)
    if mode == 'off':
        output.unlink(missing_ok=True)
        return
    if target not in ('cloud', 'rtrda02') or app != f'web-app-rtrda-preprod-{target}' or db != f'db-preprod-{target}':
        raise ValueError('invalid target binding')
    base_text = Path(base).read_text()
    if not re.search(r'^  ' + re.escape(app) + r':\s*$', base_text, re.M) or not re.search(r'^  ' + re.escape(db) + r':\s*$', base_text, re.M):
        raise ValueError('target service absent from base Compose')
    salt_path = Path(os.environ['ACTIVITY_SALT_ENV_FILE'])
    if not salt_path.is_absolute() or not re.fullmatch(r'/[A-Za-z0-9_./-]+', str(salt_path)):
        raise ValueError('invalid protected salt path')
    salt_owner = protected_metadata(salt_path).st_uid
    if salt_owner == 1001:
        # The deploy account cannot read UID1001's 0600 file. The app validates
        # its contents after mount and rolls back on any invalid salt.
        pass
    elif salt_owner == os.getuid():
        salt = protected(salt_path, ('ANALYTICS_HASH_SALT',))['ANALYTICS_HASH_SALT']
        if len(salt) < 32 or re.match(r'^(change.?me|placeholder|test|example)', salt, re.I):
            raise ValueError('invalid salt')
    else:
        raise ValueError('unexpected protected salt owner')
    oidc_path = None
    if mode in ('stage', 'active'):
        oidc_path = Path(os.environ['ACTIVITY_OIDC_ENV_FILE'])
        if not oidc_path.is_absolute() or not re.fullmatch(r'/[A-Za-z0-9_./-]+', str(oidc_path)):
            raise ValueError('invalid protected OIDC path')
        oidc = protected(oidc_path, KEYS)
        tenant = oidc['ACTIVITY_OIDC_TENANT_ID']
        if not re.fullmatch(r'[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}', tenant):
            raise ValueError('invalid tenant')
        if oidc['ACTIVITY_OIDC_ISSUER'] != f'https://login.microsoftonline.com/{tenant}/v2.0' or oidc['ACTIVITY_OIDC_REDIRECT_URI'] != CALLBACK:
            raise ValueError('invalid issuer or callback')
    release_sha = os.environ['ACTIVITY_RELEASE_SHA']
    if not re.fullmatch(r'[0-9a-f]{40}', release_sha):
        raise ValueError('invalid release SHA')
    auth_dependency = '''      activity-report-auth:
        condition: service_healthy
''' if oidc_path else ''
    auth_service = f'''  activity-report-auth:
    build:
      context: .
      dockerfile: Dockerfile
      target: activity-report-auth
    image: activity-report-auth:{target}-{release_sha}
    environment:
      ACTIVITY_OIDC_FILE: /run/secrets/activity-oidc.env
    volumes:
      - {oidc_path}:/run/secrets/activity-oidc.env:ro
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3101/healthz').then(r=>{{if(!r.ok)process.exit(1)}}).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 15s
    restart: unless-stopped
''' if oidc_path else ''
    contents = f'''services:
  {app}:
    volumes:
      - {salt_path}:/run/secrets/analytics-salt.env:ro
    environment:
      ANALYTICS_HASH_SALT_FILE: /run/secrets/analytics-salt.env
      ACTIVITY_LOGGING_ENABLED: "{'true' if mode in ('collect', 'active') else 'false'}"
      ACTIVITY_RETENTION_ENABLED: "{'true' if mode in ('collect', 'active') else 'false'}"
      ACTIVITY_REPORT_ENABLED: "{'true' if oidc_path else 'false'}"
      ANALYTICS_ENV: production
      ACTIVITY_RECORDING_HOST: {target}
      SITE_ORIGIN: https://rtrda.or.th
      DATABASE_URL: postgresql://rtrda:${{POSTGRES_PASSWORD:?database password required}}@{db}:5432/rtrda
    depends_on:
      {db}:
        condition: service_healthy
{auth_dependency}{auth_service}'''
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(contents)
    output.chmod(0o600)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, KeyError) as exc:
        print('Activity overlay unavailable: ' + type(exc).__name__, file=sys.stderr)
        sys.exit(1)
