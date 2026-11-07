import csv
import io
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

import print_dialogs as pd

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "data/invoke.json"
SETS = ROOT / "tools/calibrate/labels/sets.json"


def run(*args):
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        code = pd.main(["--data", str(DATA), "--sets", str(SETS), *args])
    return code, out.getvalue(), err.getvalue()


class PrintDialogsTest(unittest.TestCase):
    def test_dialog_markdown(self):
        with tempfile.TemporaryDirectory() as tmp:
            code, _, _ = run("--out", tmp, "--set", "p1-ru-003")
            self.assertEqual(code, 0)
            text = (Path(tmp) / "p1-ru-003.md").read_text(encoding="utf-8")
        rec = pd.load_records(DATA)["p1-ru-003"]
        lines = text.splitlines()
        self.assertEqual(lines[0], "# p1-ru-003")
        self.assertIn("tuning", lines[2])
        turns = [l for l in lines if l.startswith("[") and "] " in l.split(":")[0]]
        self.assertEqual(len(turns), len(rec["transcript"]))
        self.assertTrue(turns[0].startswith("[1] "))
        self.assertIn(" ".join(rec["transcript"][0]["text"].splitlines()), turns[0])
        rows = [l for l in lines if l.startswith("| ") and "criterion_id" not in l and "---" not in l]
        self.assertEqual(len(rows), 8)
        by_id = {r.split(" | ")[0][2:]: r for r in rows}
        self.assertIn("| yes/no/na |", by_id["understanding"])
        self.assertIn("| 0/5/10/15/20/na |", by_id["guidance"])

    def test_template_dauka(self):
        with tempfile.TemporaryDirectory() as tmp:
            run("--out", tmp, "--template", "dauka")
            with open(Path(tmp) / "labels-dauka.csv", encoding="utf-8", newline="") as f:
                rows = list(csv.reader(f))
        self.assertEqual(rows[0], pd.HEADER)
        self.assertEqual(len(rows) - 1, 56)
        self.assertEqual(rows[1][0], "p1-ru-003")
        self.assertEqual(rows[-1][0], "p1-en-014")

    def test_unknown_labeler(self):
        with tempfile.TemporaryDirectory() as tmp:
            code, _, err = run("--out", tmp, "--template", "nobody")
        self.assertEqual(code, 2)
        self.assertIn("nobody", err)


if __name__ == "__main__":
    unittest.main()
