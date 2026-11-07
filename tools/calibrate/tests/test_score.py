import re
import unittest
from pathlib import Path

from score import allowed_answers, load_checklist, percentage, score

CHECKLIST_TS = Path(__file__).resolve().parents[3] / "apps/api/src/checklist.ts"
ORDER = ["opening", "understanding", "verification", "guidance",
         "empathy", "management", "closing", "violations"]
ANSWERS = dict(zip(ORDER, ["yes", "na", "na", 15, "yes", 7, "na", "yes"]))


class ScoreTest(unittest.TestCase):
    def setUp(self):
        self.checklist = load_checklist()

    def test_reference_case(self):
        result = score(self.checklist, ANSWERS)
        self.assertEqual(result["total"], 84.17)
        self.assertTrue(result["seriousViolation"])
        self.assertEqual(result["sections"], [
            {"name": "Opening and understanding", "earned": 10, "weight": 10, "score": 100},
            {"name": "Security and resolution", "earned": 15, "weight": 20, "score": 75},
            {"name": "Managing and closing", "earned": 25.5, "weight": 30, "score": 85},
        ])

    def test_decisions_override(self):
        result = score(self.checklist, ANSWERS, {"guidance": "na", "violations": "no"})
        self.assertEqual(result["total"], 88.75)
        self.assertFalse(result["seriousViolation"])
        self.assertEqual(result["sections"][1],
                         {"name": "Security and resolution", "earned": 0, "weight": 0, "score": None})
        guidance = next(c for c in result["criteria"] if c["id"] == "guidance")
        self.assertEqual((guidance["original"], guidance["final"]), (15, "na"))
        self.assertEqual((guidance["originalPoints"], guidance["finalPoints"]), (15, None))

    def test_percentage_zero_weight(self):
        self.assertIsNone(percentage(0, 0))

    def test_invalid_answers(self):
        with self.assertRaisesRegex(ValueError, "opening"):
            score(self.checklist, {**ANSWERS, "opening": "na"})
        missing = {k: v for k, v in ANSWERS.items() if k != "closing"}
        with self.assertRaisesRegex(ValueError, "closing"):
            score(self.checklist, missing)
        with self.assertRaisesRegex(ValueError, "guidance"):
            score(self.checklist, ANSWERS, {"guidance": 12})

    def test_allowed_answers(self):
        by_id = {c["id"]: c for c in self.checklist["criteria"]}
        self.assertEqual(allowed_answers(by_id["opening"]), ["yes", "no"])
        self.assertEqual(allowed_answers(by_id["closing"]), ["yes", "no", "na"])
        self.assertEqual(allowed_answers(by_id["management"]), [0, 4, 7, 10])
        self.assertEqual(allowed_answers(by_id["guidance"]), [0, 5, 10, 15, 20, "na"])

    def test_json_matches_typescript(self):
        src = CHECKLIST_TS.read_text(encoding="utf-8")
        pattern = re.compile(
            r'id: "(\w+)",\s*title: "([^"]*)",\s*section: "([^"]*)",\s*'
            r'guidance:\s*"[^"]*",\s*weight: (\d+),\s*kind: "(\w+)",\s*'
            r'scale: \[([^\]]*)\],\s*allowNA: (true|false)')
        parsed = [
            {"id": i, "title": t, "section": s, "weight": int(w), "kind": k,
             "scale": [int(x) for x in sc.split(",") if x.strip()], "allowNA": na == "true"}
            for i, t, s, w, k, sc, na in pattern.findall(src)
        ]
        keys = ["id", "title", "section", "weight", "kind", "scale", "allowNA"]
        actual = [{k: c[k] for k in keys} for c in self.checklist["criteria"]]
        self.assertEqual(len(parsed), 8)
        self.assertEqual(actual, parsed)


if __name__ == "__main__":
    unittest.main()
