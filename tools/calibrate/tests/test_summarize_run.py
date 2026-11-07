import contextlib
import io
import json
import os
import tempfile
import unittest

from summarize_run import main, summarize


def dialog(cid, lang, violation, votes=None, failed=False):
    if failed:
        return {"conversationId": cid, "language": lang, "ratings": [], "total": None,
                "run": {"latencyMs": 1000, "costUsd": 0.0, "calls": 0}}
    return {
        "conversationId": cid,
        "language": lang,
        "ratings": [
            {"criterionId": "closing", "answer": "yes", "votes": votes or ["yes"]},
            {"criterionId": "violations", "answer": violation, "votes": [violation]},
        ],
        "total": 80.0,
        "run": {"latencyMs": 3000, "costUsd": 0.01, "calls": 1},
    }


RUN = {
    "promptVersion": "p-test", "provider": "hf-router", "model": "m", "set": "dev",
    "samples": 3, "temperature": 0.6, "commit": "abc",
    "dialogs": [
        dialog("p1-ru-022", "RU", "yes", votes=["yes", "yes", "yes"]),
        dialog("p1-ru-023", "RU", "no", votes=["yes", "no", "yes"]),
        dialog("p1-en-001", "EN", "yes"),
        dialog("p1-kz-001", "KZ", "no", failed=True),
    ],
}


class SummarizeTest(unittest.TestCase):
    def test_counts_failures_and_distribution(self):
        s = summarize(RUN)
        self.assertEqual(s["evaluated"], 3)
        self.assertEqual(s["failed"], ["p1-kz-001"])
        self.assertEqual(s["distribution"]["violations"], {"yes": 2, "no": 1})
        self.assertEqual(s["byLanguage"]["violations"]["RU"], {"yes": 1, "no": 1})

    def test_violation_flags_against_known_cases(self):
        v = summarize(RUN)["violations"]
        self.assertEqual(v["flagged"], ["p1-en-001", "p1-ru-022"])
        self.assertEqual(v["knownCaught"], ["p1-ru-022"])
        self.assertEqual(v["knownMissed"], ["p1-ru-023"])
        self.assertEqual(v["unexpected"], ["p1-en-001"])

    def test_stability_counts_unanimous_multi_vote_rows(self):
        st = summarize(RUN)["stability"]["closing"]
        # Closing has three votes in p1-ru-022 (all yes) and p1-ru-023 (yes, no, yes);
        # p1-en-001 has a single vote and is not counted.
        self.assertEqual((st["n"], st["unanimous"]), (2, 1))

    def test_cost_and_totals(self):
        s = summarize(RUN)
        self.assertEqual(s["cost"]["calls"], 3)
        self.assertAlmostEqual(s["cost"]["totalUsd"], 0.03)
        self.assertEqual(s["totals"]["mean"], 80.0)

    def test_report_has_no_text_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            run_path = os.path.join(tmp, "run.json")
            with open(run_path, "w", encoding="utf-8") as f:
                json.dump(RUN, f)
            with contextlib.redirect_stdout(io.StringIO()):
                main([run_path, "--name", "t", "--reports-dir", tmp])
            with open(os.path.join(tmp, "t.json"), encoding="utf-8") as f:
                text = f.read()
            self.assertNotIn("explanation", text)
            self.assertTrue(os.path.exists(os.path.join(tmp, "t.md")))


if __name__ == "__main__":
    unittest.main()
