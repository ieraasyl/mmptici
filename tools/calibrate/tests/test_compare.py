import contextlib
import csv
import io
import json
import tempfile
import unittest
from pathlib import Path

import compare
from score import load_checklist

FIX = Path(__file__).parent / "fixtures"
LABELS = FIX / "labels_fake.csv"
RUN = FIX / "run_fake.json"


def keys(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield k
            yield from keys(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from keys(v)


class CompareTest(unittest.TestCase):
    def go(self, *extra):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        reports, runs = Path(tmp.name) / "reports", Path(tmp.name) / "runs"
        with contextlib.redirect_stdout(io.StringIO()):
            code = compare.main(["--labels", str(LABELS), "--name", "t", "--set", "tuning",
                                 "--reports-dir", str(reports), "--runs-dir", str(runs), *extra])
        self.assertEqual(code, 0)
        report = json.loads((reports / "t.json").read_text(encoding="utf-8"))
        with open(runs / "t-mismatches.csv", encoding="utf-8", newline="") as f:
            rows = list(csv.DictReader(f))
        self.assertTrue((reports / "t.md").exists())
        return report, rows

    def test_pairs(self):
        report, rows = self.go("--pairs")
        self.assertEqual((report["labelerA"], report["labelerB"]), ("dauka", "ml-a"))
        pc = report["perCriterion"]
        # dauka vs ml-a differ on understanding (003), opening/guidance/violations (022),
        # verification/management (025): exact counts out of 3 dialogs.
        self.assertEqual(pc["opening"]["exact"], 2)
        self.assertEqual(pc["management"]["exact"], 1)
        self.assertEqual(pc["empathy"]["exact"], 3)
        self.assertEqual(report["pooled"]["exact"], 17)
        self.assertEqual(report["pooled"]["n"], 24)
        # Totals dauka/ml-a: 003 88.13 vs 75.0 (|13.13|); 022 57.5 vs 57.5 (0);
        # 025 55.0 vs 70.5 (15.5). MAE = (13.13 + 0 + 15.5) / 3 = 9.5433...
        self.assertEqual(report["totals"]["n"], 3)
        self.assertAlmostEqual(report["totals"]["mae"], 28.63 / 3, places=6)
        self.assertAlmostEqual(report["totals"]["maxError"], 15.5)
        self.assertEqual(report["violations"]["fp"], 1)
        self.assertEqual(report["breakdown"]["language"]["RU"]["n"], 24)
        self.assertEqual(report["breakdown"]["language"]["KZ"]["n"], 0)
        self.assertIsNone(report["runHealth"])
        self.assertEqual(len(report["mismatches"]), 7)
        self.assertEqual(len(rows), 7)
        self.assertEqual(sum(1 for r in rows if r["evidence_text"]), 7)
        self.assertTrue(all(r["bucket"] == "" and r["votes"] == "" for r in rows))
        self.assertEqual(pc["guidance"]["confusion"], {"15": {"15": 1}, "10": {"20": 1}, "5": {"5": 1}})
        self.assertNotIn("qwk", pc["opening"])
        self.assertIn("qwk", pc["management"])

    def test_run(self):
        report, rows = self.go("--run", str(RUN))
        self.assertEqual(report["run"]["model"], "fake-model")
        pc = report["perCriterion"]
        # "N/A" and string digits in the run file are normalized, so understanding agrees 3/3.
        self.assertEqual(pc["understanding"]["exact"], 3)
        self.assertEqual(pc["verification"]["exact"], 2)
        self.assertEqual(report["pooled"]["exact"], 19)
        # Totals final vs run: 003 88.13 vs 85.5 (2.63); 022 57.5 vs 76.25 (18.75);
        # 025 55.0 vs 50.5 (4.5). MAE = (2.63 + 18.75 + 4.5) / 3 = 25.88 / 3.
        self.assertAlmostEqual(report["totals"]["mae"], 25.88 / 3, places=6)
        self.assertAlmostEqual(report["totals"]["maxError"], 18.75)
        h = report["runHealth"]
        self.assertEqual((h["dialogs"], h["failedSamples"], h["meanLatencyMs"]), (3, 1, 2000))
        self.assertAlmostEqual(h["costUsd"], 0.06)
        self.assertEqual(h["missingFromRun"], [])
        self.assertEqual(len(rows), 5)
        self.assertEqual(len(report["mismatches"]), 5)
        v = next(r for r in rows if r["criterion_id"] == "violations")
        self.assertEqual(v["votes"], "yes@m1;yes@m2")
        self.assertEqual(v["explanation"], "fake explanation")
        self.assertEqual(v["evidence_turns"], "1;2")
        self.assertIn(" | ", v["evidence_text"])

    def test_report_has_no_text_fields(self):
        for extra in (["--pairs"], ["--run", str(RUN)]):
            report, _ = self.go(*extra)
            self.assertFalse({"explanation", "note", "text"} & set(keys(report)))

    def test_invalid_label_reported(self):
        checklist = load_checklist()
        rows = compare.read_labels(LABELS)
        rows[0]["answer"] = "na"  # opening does not allow na
        rows[1]["conversation_id"] = "nope"
        problems = compare.check_labels(rows, checklist, {"p1-ru-003", "p1-ru-022", "p1-ru-025"})
        self.assertIn("row 2: answer 'na' not allowed for opening", problems)
        self.assertIn("row 3: unknown conversation 'nope'", problems)

    def test_invalid_label_exit_status(self):
        with tempfile.TemporaryDirectory() as tmp:
            bad = Path(tmp) / "bad.csv"
            bad.write_text(LABELS.read_text(encoding="utf-8").replace("p1-ru-003,dauka,opening,yes",
                                                                      "p1-ru-003,dauka,opening,na"),
                           encoding="utf-8")
            err = io.StringIO()
            with contextlib.redirect_stderr(err):
                code = compare.main(["--labels", str(bad), "--name", "t", "--pairs",
                                     "--reports-dir", f"{tmp}/r", "--runs-dir", f"{tmp}/u"])
            self.assertIn("row 2: answer 'na' not allowed for opening", err.getvalue())
            self.assertEqual(code, 1)
            self.assertFalse((Path(tmp) / "r").exists())


if __name__ == "__main__":
    unittest.main()
