import json
import unittest
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SETS = json.loads((ROOT / "tools/calibrate/labels/sets.json").read_text(encoding="utf-8"))
RECORDS = {r["conversation_id"]: r for r in
           json.loads((ROOT / "data/invoke.json").read_text(encoding="utf-8"))["data"]["records"]}


class SetsTest(unittest.TestCase):
    def setUp(self):
        self.tuning, self.heldout = SETS["tuning"], SETS["heldout"]
        self.all20 = self.tuning + self.heldout

    def test_sizes_and_no_overlap(self):
        self.assertEqual((len(self.tuning), len(self.heldout)), (14, 6))
        self.assertEqual(len(set(self.all20)), 20)

    def test_ids_exist_in_dataset(self):
        for cid in self.all20:
            self.assertIn(cid, RECORDS)

    def test_language_and_channel_mix(self):
        recs = [RECORDS[c] for c in self.all20]
        chats = Counter(r["language"] for r in recs if r["channel"] == "agent chat")
        self.assertEqual(chats, {"RU": 7, "KZ": 5, "EN": 5})
        self.assertEqual(sum(r["channel"] == "voice call" for r in recs), 3)

    def test_families(self):
        fam = SETS["families"]
        for cid in self.all20:
            self.assertIn(cid, fam)
        self.assertFalse({fam[c] for c in self.tuning} & {fam[c] for c in self.heldout})

    def test_assignments(self):
        asg = SETS["assignments"]
        primaries = Counter(c for a in asg.values() for c in a["primary"])
        for cid in self.tuning:
            self.assertEqual(primaries[cid], 1, cid)
        seconds = [(c, l) for l, a in asg.items() for c in a["second"]]
        self.assertEqual(len(seconds), 10)
        for cid, labeler in seconds:
            self.assertIn(cid, self.tuning)
            self.assertNotIn(cid, asg[labeler]["primary"])
        for cid in self.heldout:
            self.assertNotIn(cid, [c for c, _ in seconds])
            self.assertEqual(primaries[cid] + (cid in SETS["unassigned"]), 1, cid)


if __name__ == "__main__":
    unittest.main()
