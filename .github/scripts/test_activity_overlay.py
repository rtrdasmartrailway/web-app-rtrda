import os
import pathlib
import stat
import subprocess
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).with_name('activity-production-overlay.py')
TENANT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
OIDC = f'''ACTIVITY_OIDC_TENANT_ID={TENANT}
ACTIVITY_OIDC_CLIENT_ID=synthetic-app
ACTIVITY_OIDC_CLIENT_SECRET=synthetic-secret
ACTIVITY_OIDC_ISSUER=https://login.microsoftonline.com/{TENANT}/v2.0
ACTIVITY_OIDC_REDIRECT_URI=https://rtrda.or.th/api/analytics/activity-auth/callback
'''

class OverlayTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = pathlib.Path(self.tmp.name)
        self.oidc = self.root / 'oidc.env'
        self.salt = self.root / 'salt.env'
        self.overlay = self.root / 'overlay.yml'
        self.base = self.root / 'base.yml'
        self.base.write_text('services:\n  web-app-rtrda-preprod-cloud:\n    image: busybox\n    command: sleep 100\n  db-preprod-cloud:\n    image: busybox\n    command: sleep 100\n')
        self.write(self.oidc, OIDC)
        self.write(self.salt, 'ANALYTICS_HASH_SALT=' + 's' * 48 + '\n')

    def write(self, path, text, mode=0o600):
        path.write_text(text)
        path.chmod(mode)

    def run_overlay(self, target='cloud', enabled='stage', oidc=None, salt=None, app=None, db=None):
        env = dict(os.environ, ACTIVITY_DEPLOY_MODE=enabled, ACTIVITY_RELEASE_SHA='a'*40,
                   ACTIVITY_OIDC_ENV_FILE=str(oidc or self.oidc),
                   ACTIVITY_SALT_ENV_FILE=str(salt or self.salt))
        return subprocess.run(['python3', str(SCRIPT), target,
            app or 'web-app-rtrda-preprod-' + target,
            db or 'db-preprod-' + target,
            str(self.base), str(self.overlay)], env=env, text=True, capture_output=True)

    def test_default_off_without_protected_files(self):
        self.oidc.unlink(); self.salt.unlink()
        result = self.run_overlay(enabled='off')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(self.overlay.exists())
        self.assertNotIn('synthetic', result.stdout + result.stderr)

    def test_collect_requires_only_protected_salt_and_never_starts_auth(self):
        import json
        self.oidc.unlink()
        result = self.run_overlay(enabled='collect')
        self.assertEqual(result.returncode, 0, result.stderr)
        text = self.overlay.read_text()
        self.assertNotIn('activity-report-auth:', text)
        self.assertNotIn('ACTIVITY_OIDC_FILE', text)
        self.assertIn('ACTIVITY_LOGGING_ENABLED: "true"', text)
        self.assertIn('ACTIVITY_RETENTION_ENABLED: "true"', text)
        self.assertIn('ACTIVITY_RECORDING_HOST: cloud', text)
        config = subprocess.run(['docker', 'compose', '-f', str(self.base), '-f', str(self.overlay), 'config', '--format', 'json'],
            env=dict(os.environ, POSTGRES_PASSWORD='synthetic-db'), capture_output=True, text=True)
        self.assertEqual(config.returncode, 0, config.stderr)
        services = json.loads(config.stdout)['services']
        self.assertNotIn('activity-report-auth', services)
        app = services['web-app-rtrda-preprod-cloud']
        self.assertNotIn('activity-report-auth', app.get('depends_on', {}))
        self.assertEqual(app['environment']['ACTIVITY_LOGGING_ENABLED'], 'true')
        self.assertEqual(app['environment']['ACTIVITY_RETENTION_ENABLED'], 'true')
        self.assertNotIn('s' * 48, json.dumps(services))

    def test_uid1001_salt_is_validated_in_app_not_read_by_deploy_user(self):
        import importlib.util
        from unittest.mock import patch
        from types import SimpleNamespace
        import sys
        spec = importlib.util.spec_from_file_location('activity_overlay', SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        original_lstat = pathlib.Path.lstat
        original_read = pathlib.Path.read_text
        def lstat(path):
            if path == self.salt:
                return SimpleNamespace(st_mode=stat.S_IFREG | 0o600, st_uid=1001)
            return original_lstat(path)
        def read(path, *args, **kwargs):
            if path == self.salt:
                raise PermissionError('deploy user cannot read UID1001 salt')
            return original_read(path, *args, **kwargs)
        argv = ['overlay', 'cloud', 'web-app-rtrda-preprod-cloud', 'db-preprod-cloud', str(self.base), str(self.overlay)]
        env = dict(os.environ, ACTIVITY_DEPLOY_MODE='collect', ACTIVITY_RELEASE_SHA='a'*40,
                   ACTIVITY_SALT_ENV_FILE=str(self.salt))
        with patch.dict(os.environ, env), patch.object(sys, 'argv', argv), \
             patch.object(pathlib.Path, 'lstat', lstat), patch.object(pathlib.Path, 'read_text', read):
            module.main()
        self.assertTrue(self.overlay.exists())
        remote = SCRIPT.with_name('deploy-preprod-remote.sh').read_text()
        attest = SCRIPT.with_name('attest-activity-target.sh').read_text()
        self.assertIn('node -e', remote)
        self.assertIn('ANALYTICS_HASH_SALT=', remote)
        self.assertIn('ANALYTICS_HASH_SALT=', attest)
        import ast
        salt_line = next(line for line in attest.splitlines() if line.strip().startswith('salt_check = '))
        js = ast.literal_eval(salt_line.strip().split(' = ', 1)[1])
        syntax = subprocess.run(['node', '--check'], input=js, capture_output=True, text=True)
        self.assertEqual(syntax.returncode, 0, syntax.stderr)
        for salt, expected in (('s'*48, 0), ('placeholder'*5, 1), ('short', 1), ('s'*48 + '!', 1)):
            stub = 'const fs={readFileSync:()=>"ANALYTICS_HASH_SALT=' + salt + '"};'
            result = subprocess.run(['node', '-e', js.replace('const fs=require("node:fs");', stub)],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode == 0, expected == 0, (salt[:12], result.stderr))

    def test_collect_fails_closed_with_missing_or_invalid_salt(self):
        self.oidc.unlink()
        self.salt.unlink()
        self.assertNotEqual(self.run_overlay(enabled='collect').returncode, 0)
        self.write(self.salt, 'ANALYTICS_HASH_SALT=' + 's'*48 + '\n', mode=0o644)
        self.assertNotEqual(self.run_overlay(enabled='collect').returncode, 0)
        self.write(self.salt, 'ANALYTICS_HASH_SALT=placeholder\n')
        self.assertNotEqual(self.run_overlay(enabled='collect').returncode, 0)

    def test_collect_is_an_explicit_preservable_mode(self):
        workflow = (SCRIPT.parents[2] / '.github/workflows/deploy-production.yml').read_text()
        resolver = SCRIPT.with_name('resolve-activity-mode.sh').read_text()
        self.assertIn('          - collect', workflow)
        self.assertIn('preserve|off|collect|stage|active', resolver)

    def test_deploy_target_accepts_explicit_collect_mode(self):
        script = SCRIPT.with_name('deploy-preprod-target.sh').read_text()
        self.assertIn('case "$ACTIVITY_DEPLOY_MODE" in off|collect|stage|active)', script)

    def test_opt_in_requires_both_protected_regular_0600_files(self):
        for missing in (self.oidc, self.salt):
            with self.subTest(missing=missing.name):
                missing.unlink()
                self.assertNotEqual(self.run_overlay().returncode, 0)
                self.write(missing, OIDC if missing == self.oidc else 'ANALYTICS_HASH_SALT=' + 's'*48 + '\n')
        self.oidc.chmod(0o644)
        self.assertNotEqual(self.run_overlay().returncode, 0)
        self.oidc.chmod(0o600)
        self.oidc.unlink(); self.oidc.symlink_to(self.salt)
        self.assertNotEqual(self.run_overlay().returncode, 0)

    def test_invalid_credentials_or_callback_fail_closed(self):
        for text in (OIDC.replace('synthetic-secret', ''), OIDC.replace('rtrda.or.th', 'test.rtrda.or.th'), OIDC.replace('synthetic-app', '$(id)'), OIDC.replace(TENANT, 'common')):
            with self.subTest(text=text[-85:]):
                self.write(self.oidc, text)
                self.assertNotEqual(self.run_overlay().returncode, 0)

    def test_wrong_target_service_names_or_db_binding_fail_closed(self):
        self.assertNotEqual(self.run_overlay(app='web-app-rtrda-test').returncode, 0)
        self.assertNotEqual(self.run_overlay(db='db-preprod-rtrda02').returncode, 0)
        self.assertNotEqual(self.run_overlay(target='test').returncode, 0)
        self.base.write_text(self.base.read_text().replace('db-preprod-cloud:', 'db-other:'))
        self.assertNotEqual(self.run_overlay().returncode, 0)

    def test_staged_overlay_is_private_healthy_and_logger_off(self):
        result = self.run_overlay()
        self.assertEqual(result.returncode, 0, result.stderr)
        text = self.overlay.read_text()
        self.assertNotIn('synthetic-secret', text)
        self.assertNotIn('ports:', text)
        self.assertIn('ACTIVITY_LOGGING_ENABLED: "false"', text)
        self.assertIn('ACTIVITY_RECORDING_HOST: cloud', text)
        self.assertIn('condition: service_healthy', text)
        self.assertIn('db-preprod-cloud:', text)
        self.assertIn('/run/secrets/activity-oidc.env:ro', text)
        config = subprocess.run(['docker', 'compose', '-f', str(self.base), '-f', str(self.overlay), 'config', '--format', 'json'], env=dict(os.environ, ACTIVITY_RELEASE_SHA='a'*40, POSTGRES_PASSWORD='synthetic-db'), capture_output=True, text=True)
        self.assertEqual(config.returncode, 0, config.stderr)
        import json
        services = json.loads(config.stdout)['services']
        self.assertNotIn('ports', services['activity-report-auth'])
        self.assertEqual(services['web-app-rtrda-preprod-cloud']['environment']['ACTIVITY_LOGGING_ENABLED'], 'false')
        self.assertEqual(services['web-app-rtrda-preprod-cloud']['depends_on']['activity-report-auth']['condition'], 'service_healthy')
        self.assertEqual(services['web-app-rtrda-preprod-cloud']['depends_on']['db-preprod-cloud']['condition'], 'service_healthy')
        self.assertEqual(services['web-app-rtrda-preprod-cloud']['environment']['DATABASE_URL'], 'postgresql://rtrda:synthetic-db@db-preprod-cloud:5432/rtrda')
        self.assertNotIn('ACTIVITY_OIDC_CLIENT_SECRET', services['web-app-rtrda-preprod-cloud']['environment'])

    def test_compose_and_inspect_never_contain_protected_values(self):
        import json
        result = self.run_overlay()
        self.assertEqual(result.returncode, 0, result.stderr)
        config = subprocess.run(['docker', 'compose', '-f', str(self.base), '-f', str(self.overlay), 'config', '--format', 'json'], env=dict(os.environ, POSTGRES_PASSWORD='synthetic-db'), capture_output=True, text=True)
        self.assertEqual(config.returncode, 0, config.stderr)
        services = json.loads(config.stdout)['services']
        for service in (services['activity-report-auth'], services['web-app-rtrda-preprod-cloud']):
            self.assertNotIn('synthetic-secret', json.dumps(service))
            self.assertNotIn('s' * 48, json.dumps(service))
            self.assertNotIn('env_file', service)
            self.assertNotIn('ACTIVITY_OIDC_CLIENT_SECRET', service.get('environment', {}))
            self.assertNotIn('ANALYTICS_HASH_SALT', service.get('environment', {}))
        self.assertNotIn('synthetic-secret', config.stdout)
        self.assertNotIn('s' * 48, config.stdout)
        self.assertIn('/run/secrets/activity-oidc.env', json.dumps(services['activity-report-auth']['volumes']))
        self.assertIn('/run/secrets/analytics-salt.env', json.dumps(services['web-app-rtrda-preprod-cloud']['volumes']))

    def test_preswap_failures_restore_git_compose_overlay_and_env(self):
        remote = (SCRIPT.parents[2] / '.github/scripts/deploy-preprod-remote.sh').read_text()
        self.assertIn('trap on_deploy_failure ERR', remote)
        self.assertIn('rollback_previous_release', remote)
        self.assertIn('PREVIOUS_ENV', remote)
        self.assertIn('PREVIOUS_SHA', remote)
        self.assertIn('git checkout -f -B preprod "$PREVIOUS_SHA"', remote)
        self.assertIn('cp "$PREVIOUS_COMPOSE" "$COMPOSE_FILE"', remote)
        self.assertIn('rollback_activity_overlay', remote)
        self.assertIn('run_node npm ci', remote)
        self.assertIn('run_node npm run db:migrate', remote)
        self.assertIn('run_node npm run db:seed', remote)
        self.assertIn('node -e', remote)
        self.assertIn('ANALYTICS_HASH_SALT=', remote)

    def test_backup_manifest_includes_mode_and_overlay_integrity(self):
        backup = (SCRIPT.parents[2] / '.github/scripts/backup-rtrda02-production.sh').read_text()
        self.assertIn('activity-overlay.yml', backup)
        self.assertIn('activityMode', backup)
        self.assertIn('files=(database.dump compose.yml', backup)
        self.assertIn('overlaySha256', backup)

    def test_release_preserves_active_mode_and_parity_attests_both(self):
        workflow = (SCRIPT.parents[2] / '.github/workflows/deploy-production.yml').read_text()
        self.assertIn('activity_mode:', workflow)
        self.assertIn('preserve', workflow)
        self.assertIn('resolve-activity-mode.sh', workflow)
        self.assertNotIn("inputs.activity_activate && 'active'", workflow)
        self.assertIn('attest-activity-target.sh', workflow)
        self.assertIn('activity-report-auth', workflow)

    def test_runner_uid_can_read_protected_salt_and_missing_prior_release_is_off(self):
        result = self.run_overlay()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('ANALYTICS_HASH_SALT_FILE', self.overlay.read_text())
        remote = (SCRIPT.parents[2] / '.github/scripts/deploy-preprod-remote.sh').read_text()
        self.assertIn('git rev-parse HEAD', remote)
        self.assertIn('on_deploy_failure', remote)
        self.assertIn('Database migrations and destructive seed changes are NOT automatically reversed', remote)
        attest = (SCRIPT.parents[2] / '.github/scripts/attest-activity-target.sh').read_text()
        self.assertIn('protected_mount(container, app', attest)
        self.assertIn("else None", attest)

    def test_preserve_resolver_keeps_active_and_rejects_disagreement(self):
        import json
        resolver = SCRIPT.with_name('resolve-activity-mode.sh')
        fakebin = self.root / 'fakebin'; fakebin.mkdir()
        ssh = fakebin / 'ssh'
        ssh.write_text('#!/bin/bash\nif [[ "$*" == *"ubuntu@"* ]]; then printf "%s\n" "$CLOUD"; else printf "%s\n" "$FALLBACK"; fi\n')
        ssh.chmod(0o755)
        record = lambda mode: json.dumps(dict(mode=mode, sha='a'*40))
        env = dict(os.environ, PATH=f'{fakebin}:{os.environ["PATH"]}', SOURCE_PATH=str(SCRIPT.parents[2]), CLOUD=record('active'), FALLBACK=record('active'))
        result = subprocess.run(['bash', str(resolver), 'preserve'], env=env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), 'active')
        env['FALLBACK'] = record('off')
        result = subprocess.run(['bash', str(resolver), 'preserve'], env=env, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('active', result.stdout)

    def test_npm_failure_restores_preswap_checkout_compose_overlay_and_env(self):
        for failing in ('ci', 'db:migrate', 'db:seed'):
            with self.subTest(failing=failing):
                target = self.root / failing.replace(':', '-'); target.mkdir()
            (target / '.git').mkdir(); (target / '.deploy-state').mkdir()
            base = target / 'base.yml'
            original = 'services:\n  web-app-rtrda-preprod-cloud:\n    image: busybox\n  db-preprod-cloud:\n    image: busybox\n'
            base.write_text(original)
            (target / '.deploy-state/preprod-release').write_text('a'*40)
            (target / '.deploy-state/activity-overlay.yml').write_text('old overlay')
            (target / '.env').write_text('POSTGRES_PASSWORD=synthetic-db\n')
            (target / '.env.cicd-preprod').write_text('old generated env\n')
            fakebin = self.root / 'bin'; fakebin.mkdir(exist_ok=True)
            for name, body in {
                'git': '#!/bin/bash\nif [ "$1" = rev-parse ]; then printf "%s\n" "' + 'a'*40 + '"; fi\nexit 0\n',
                'npm': '#!/bin/bash\nif [[ "$*" == *"$FAIL_AT"* ]]; then exit 7; fi\nexit 0\n',
                'npx': '#!/bin/bash\nexit 0\n',
                'curl': '#!/bin/bash\nexit 0\n',
                'docker': '#!/bin/bash\nexit 0\n',
            }.items():
                file = fakebin / name; file.write_text(body); file.chmod(0o755)
            # Fail at npm ci after Git/Compose/overlay changes, without touching real targets.
            overlay_script = self.root / 'overlay.py'
            overlay_script.write_text('#!/usr/bin/env python3\nimport pathlib,sys\npathlib.Path(sys.argv[-1]).write_text("new overlay")\n')
            env = dict(os.environ, PATH=f'{fakebin}:{os.environ["PATH"]}', TARGET_NAME='cloud', TARGET_PATH=str(target), COMPOSE_FILE='base.yml', APP_SERVICE='web-app-rtrda-preprod-cloud', DB_SERVICE='db-preprod-cloud', DB_HOST_PORT='5436', DIRECT_HEALTH_URL='http://127.0.0.1/healthz', DEPLOY_SHA='b'*40, ACTIVITY_DEPLOY_MODE='off', ACTIVITY_OVERLAY_SCRIPT=str(overlay_script), FAIL_AT=failing)
            result = subprocess.run(['bash', str(SCRIPT.with_name('deploy-preprod-remote.sh'))], env=env, capture_output=True, text=True, timeout=15)
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(base.read_text(), original)
            self.assertEqual((target / '.deploy-state/activity-overlay.yml').read_text(), 'old overlay')
            self.assertEqual((target / '.env').read_text(), 'POSTGRES_PASSWORD=synthetic-db\n')
            self.assertEqual((target / '.env.cicd-preprod').read_text(), 'old generated env\n')

    def test_canonical_deploy_wires_opt_in_and_rollback(self):
        root = SCRIPT.parents[2]
        target = (root / '.github/scripts/deploy-preprod-target.sh').read_text()
        remote = (root / '.github/scripts/deploy-preprod-remote.sh').read_text()
        workflow = (root / '.github/workflows/deploy-production.yml').read_text()
        self.assertIn('ACTIVITY_DEPLOY_MODE:', workflow)
        self.assertIn('ACTIVITY_DEPLOY_MODE=', target)
        self.assertIn('ACTIVITY_DEPLOY_MODE=', remote)
        self.assertIn('activity-production-overlay.py', target)
        self.assertIn('ACTIVITY_OVERLAY_SCRIPT', remote)
        self.assertIn('activity-report-auth', remote)
        self.assertIn('rollback_activity_overlay', remote)
        self.assertIn('r.status===401', remote)

    def test_rollback_removes_new_service_and_restores_previous_overlay(self):
        remote = (SCRIPT.parents[2] / '.github/scripts/deploy-preprod-remote.sh').read_text()
        function = remote[remote.index('rollback_activity_overlay() {'):remote.index('\nrollback_previous_release() {')]
        fakebin = self.root / 'bin'; fakebin.mkdir(exist_ok=True)
        docker = fakebin / 'docker'
        docker.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$DOCKER_LOG"\n')
        docker.chmod(0o755)
        log = self.root / 'docker.log'
        self.overlay.write_text('services:\n  activity-report-auth:\n')
        env = dict(os.environ, PATH=f'{fakebin}:{os.environ["PATH"]}', DOCKER_LOG=str(log))
        shell = f'''set -eu
ACTIVITY_OVERLAY={self.overlay}
PREVIOUS_OVERLAY={self.root}/previous.yml
COMPOSE_FILE={self.base}
COMPOSE_ARGS=(-f "$COMPOSE_FILE" -f "$ACTIVITY_OVERLAY")
{function}
rollback_activity_overlay
[ ! -e "$ACTIVITY_OVERLAY" ]
'''
        result = subprocess.run(['bash', '-c', shell], env=env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('rm -sf activity-report-auth', log.read_text())
        self.overlay.write_text('services:\n  activity-report-auth:\n')
        (self.root / 'previous.yml').write_text('services:\n  activity-report-auth:\n# previous overlay\n')
        log.unlink()
        result = subprocess.run(['bash', '-c', shell.replace('[ ! -e "$ACTIVITY_OVERLAY" ]', '[ "$(cat "$ACTIVITY_OVERLAY" | tail -1)" = "# previous overlay" ]')], env=env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(log.exists(), 'existing auth service must not be removed on rollback')

    def test_attestation_checks_live_protected_mounts_and_readability(self):
        script = SCRIPT.with_name('attest-activity-target.sh')
        target = self.root / 'attest'; target.mkdir()
        (target / '.deploy-state').mkdir()
        (target / '.deploy-state/activity-overlay.yml').write_text('ACTIVITY_LOGGING_ENABLED: "false"\nACTIVITY_RETENTION_ENABLED: "false"\n')
        fakebin = self.root / 'attest-bin'; fakebin.mkdir()
        docker = fakebin / 'docker'
        docker.write_text("""#!/usr/bin/env python3
import json, os, sys
args=sys.argv[1:]
if args[0] == 'ps':
    print('auth-id' if os.environ.get('ORPHAN_AUTH') else '')
elif 'ps' in args:
    print('auth-id' if args[-1] == 'activity-report-auth' else 'app-id')
elif args[0] == 'inspect':
    auth = args[-1] == 'auth-id'
    destination = '/run/secrets/activity-oidc.env' if auth else '/run/secrets/analytics-salt.env'
    source = os.environ['TARGET_PATH'] + ('/.activity-secrets/oidc.env' if auth else '/.activity-secrets/analytics-salt.env')
    if os.environ.get('BAD_MOUNT') == ('auth' if auth else 'app'): destination = '/wrong'
    if os.environ.get('BAD_SOURCE') == ('auth' if auth else 'app'): source = '/wrong/source'
    print(json.dumps([{'Config': {'Env': ['ACTIVITY_OIDC_FILE=/run/secrets/activity-oidc.env'] if auth else ['ACTIVITY_LOGGING_ENABLED=' + ('true' if os.environ.get('EXPECTED_MODE') in ('collect', 'active') else 'false'), 'ACTIVITY_RETENTION_ENABLED=' + ('true' if os.environ.get('EXPECTED_MODE') in ('collect', 'active') else 'false'), 'ACTIVITY_REPORT_ENABLED=' + ('true' if os.environ.get('EXPECTED_MODE') in ('stage', 'active') else 'false'), 'ACTIVITY_RECORDING_HOST=cloud', 'ANALYTICS_HASH_SALT_FILE=/run/secrets/analytics-salt.env'], 'Image': 'synthetic', 'Labels': {'com.docker.compose.project': 'synthetic'}}, 'State': {'Health': {'Status': 'healthy'}}, 'Mounts': [{'Destination': destination, 'Source': source, 'RW': os.environ.get('WRITABLE') == ('auth' if auth else 'app'), 'Type': 'bind'}]}]))
elif 'exec' in args:
    sys.exit(1 if os.environ.get('UNREADABLE') == ('auth' if args[-4] == 'activity-report-auth' else 'app') else 0)
""")
        docker.chmod(0o755)
        git = fakebin / 'git'
        git.write_text('#!/bin/sh\nprintf "%s\n" "' + 'a'*40 + '"\n')
        git.chmod(0o755)
        env = dict(os.environ, PATH=f'{fakebin}:{os.environ["PATH"]}', TARGET_PATH=str(target), APP_SERVICE='web-app-rtrda-preprod-cloud', TARGET_NAME='cloud', REQUIRE_PROTECTED='1')
        for mode in ('stage', 'active', 'collect'):
            auth_line = '  activity-report-auth:\n' if mode != 'collect' else ''
            (target / '.deploy-state/activity-overlay.yml').write_text(f'services:\n{auth_line}ACTIVITY_LOGGING_ENABLED: "{str(mode in ("active", "collect")).lower()}"\nACTIVITY_RETENTION_ENABLED: "{str(mode in ("active", "collect")).lower()}"\n')
            # Mock runtime mode must track overlay.
            env['EXPECTED_MODE'] = mode
            faults = ({}, {'BAD_MOUNT': 'app'}, {'BAD_SOURCE': 'app'}, {'WRITABLE': 'app'}, {'UNREADABLE': 'app'})
            faults += (({'ORPHAN_AUTH': '1'},) if mode == 'collect' else ({'BAD_MOUNT': 'auth'}, {'BAD_SOURCE': 'auth'}, {'WRITABLE': 'auth'}, {'UNREADABLE': 'auth'}))
            for fault in faults:
                result = subprocess.run(['bash', str(script)], env=dict(env, **fault), capture_output=True, text=True)
                self.assertEqual(result.returncode == 0, not fault, (mode, fault, result.stderr))
                self.assertNotIn('synthetic-secret', result.stdout + result.stderr)

    def test_manifest_seed_gate_compares_previous_release_bytes(self):
        remote = SCRIPT.with_name('deploy-preprod-remote.sh').read_text()
        self.assertIn('seed_required() {', remote)
        function = remote[remote.index('seed_required() {'):remote.index('\nrun_node npm run db:migrate')]
        repo = self.root / 'manifest'; repo.mkdir()
        (repo / 'src/data').mkdir(parents=True)
        (repo / 'src/data/wp-content.json').write_bytes(b'previous bytes\n')
        fakebin = self.root / 'seed-bin'; fakebin.mkdir()
        git = fakebin / 'git'
        git.write_text('#!/bin/sh\nif [ "$1" = show ]; then printf "previous bytes\n"; fi\n')
        git.chmod(0o755)
        env = dict(os.environ, PATH=f'{fakebin}:{os.environ["PATH"]}')
        def check(known):
            return subprocess.run(['bash', '-c', 'PREVIOUS_RELEASE_KNOWN=' + known + '; PREVIOUS_SHA=' + 'a'*40 + '; ' + function + '\nseed_required'], cwd=repo, env=env).returncode
        self.assertNotEqual(check('true'), 0, 'identical previous release skips seed')
        self.assertIn('if seed_required; then', remote)
        self.assertIn('run_node npm run db:seed', remote)
        (repo / 'src/data/wp-content.json').write_bytes(b'changed bytes\n')
        self.assertEqual(check('true'), 0, 'changed content keeps seed')
        (repo / 'src/data/wp-content.json').write_bytes(b'previous bytes\n')
        self.assertEqual(check('false'), 0, 'unknown previous release keeps seed')

    def test_activation_separate_flag_and_target_binding(self):
        result = self.run_overlay(enabled='active')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('ACTIVITY_LOGGING_ENABLED: "true"', self.overlay.read_text())
        self.assertIn('ANALYTICS_ENV: production', self.overlay.read_text())
        self.base.write_text(self.base.read_text().replace('cloud', 'rtrda02'))
        result = self.run_overlay(target='rtrda02')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('ACTIVITY_RECORDING_HOST: rtrda02', self.overlay.read_text())
        self.assertIn('db-preprod-rtrda02:', self.overlay.read_text())

if __name__ == '__main__':
    unittest.main()
