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
        fakebin = self.root / 'bin'; fakebin.mkdir()
        docker = fakebin / 'docker'
        docker.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$DOCKER_LOG"\n')
        docker.chmod(0o755)
        log = self.root / 'docker.log'
        self.overlay.write_text('new overlay')
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
        self.overlay.write_text('new overlay')
        (self.root / 'previous.yml').write_text('previous overlay')
        log.unlink()
        result = subprocess.run(['bash', '-c', shell.replace('[ ! -e "$ACTIVITY_OVERLAY" ]', '[ "$(cat "$ACTIVITY_OVERLAY")" = "previous overlay" ]')], env=env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(log.exists(), 'existing auth service must not be removed on rollback')

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
