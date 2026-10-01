"""Canary for the owner-only RTRDA Dev handoff."""

import unittest
from pathlib import Path


DOCUMENT = Path(__file__).resolve().parents[2] / "docs" / "rtrda-dev-handoff.md"


class RtrdaDevHandoffTest(unittest.TestCase):
    def test_owner_only_and_production_approval(self):
        text = DOCUMENT.read_text(encoding="utf-8")
        self.assertIn("owner-only", text)
        self.assertIn("branch แยก", text)
        self.assertIn("ห้าม merge หรือ deploy Production อัตโนมัติ", text)
        self.assertIn("Production ต้องได้รับการอนุมัติอย่างชัดเจนจากเจ้าของ", text)


if __name__ == "__main__":
    unittest.main()
