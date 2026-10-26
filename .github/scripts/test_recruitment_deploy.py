from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]


class RecruitmentDeployTests(unittest.TestCase):
    def test_both_deploys_apply_targeted_notice_after_manifest_gate(self):
        test = (ROOT / '.github/workflows/deploy-test.yml').read_text()
        prod = (ROOT / '.github/scripts/deploy-preprod-remote.sh').read_text()
        self.assertIn('node scripts/apply-recruitment-notice.mjs', test)
        self.assertIn('run_node node scripts/apply-recruitment-notice.mjs', prod)
        self.assertGreater(test.index('node scripts/apply-recruitment-notice.mjs'), test.index('npm run db:seed'))
        self.assertGreater(prod.index('run_node node scripts/apply-recruitment-notice.mjs'), prod.index('run_node npm run db:seed'))
        # The targeted write must not be hidden inside seed_required's branch.
        self.assertIn('fi\nrun_node node scripts/apply-recruitment-notice.mjs', prod)

    def test_targeted_runner_is_transactional_and_never_truncates(self):
        runner = (ROOT / 'scripts/apply-recruitment-notice.mjs').read_text()
        self.assertIn('applyRecruitmentNoticeOverride(client)', runner)
        self.assertIn('BEGIN', runner)
        self.assertIn('COMMIT', runner)
        self.assertIn('ROLLBACK', runner)
        self.assertNotIn('TRUNCATE', runner)


if __name__ == '__main__':
    unittest.main()
