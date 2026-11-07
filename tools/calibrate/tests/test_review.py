import contextlib
import csv
import io
import json
import tempfile
import unittest
from pathlib import Path

import review
from score import load_checklist

HEADER = "conversation_id,labeler,criterion_id,answer,evidence_turns,note\n"
CRITS = [c["id"] for c in load_checklist()["criteria"]]
DATA = {"data": {"records": [{"conversation_id": "d1", "language": "EN", "channel": "agent chat",
                              "transcript": [{"speaker": "client", "text": "hello SECRETTEXT"},
                                             {"speaker": "bot", "text": "hi there"},
                                             {"speaker": "client", "text": "third turn"}]},
                             {"conversation_id": "d2", "language": "RU", "channel": "agent chat",
                              "transcript": [{"speaker": "client", "text": "x"}]}]}}
SETS = {"tuning": ["d1"], "heldout": ["d2"]}


def line(conv, who, cid, ans, ev="", note=""):
    return f"{conv},{who},{cid},{ans},{ev},{note}\n"


class ReviewTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.dir = Path(tmp.name)
        (self.dir / "data.json").write_text(json.dumps(DATA), encoding="utf-8")
        (self.dir / "sets.json").write_text(json.dumps(SETS), encoding="utf-8")

    def write(self, name, lines):
        p = self.dir / name
        p.write_text(HEADER + "".join(lines), encoding="utf-8")
        return str(p)

    def files(self, a_lines, b_lines):
        return [self.write("a.csv", a_lines), self.write("b.csv", b_lines)]

    def run_cli(self, *argv):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = review.main([*argv, "--data", str(self.dir / "data.json"),
                                "--sets", str(self.dir / "sets.json")])
        return code, out.getvalue(), err.getvalue()

    def sheet(self, labels, set_spec="d1"):
        return self.run_cli("sheet", "--labels", *labels, "--set", set_spec, "--name", "t",
                            "--runs-dir", str(self.dir / "runs"), "--labels-dir", str(self.dir / "lab"))

    def decisions(self):
        with open(self.dir / "lab" / "t-decisions.csv", encoding="utf-8", newline="") as f:
            return list(csv.DictReader(f))

    def scenario(self):
        a = [line("d1", "A", "opening", "yes", "1"), line("d1", "A", "understanding", "yes", "2"),
             line("d1", "A", CRITS[2], "no", "3", "UNSURE: maybe"), line("d1", "A", CRITS[3], "na")]
        b = [line("d1", "B", "opening", "yes", "2"), line("d1", "B", "understanding", "no", "1"),
             line("d1", "B", CRITS[2], "no", "3")]
        return self.files(a, b)

    def test_detection(self):
        code, out, _ = self.sheet(self.scenario())
        self.assertEqual(code, 0)
        rows = self.decisions()
        self.assertEqual([r["criterion_id"] for r in rows], ["understanding", CRITS[2], CRITS[3]])
        self.assertEqual(rows[2]["b_answer"], "")
        self.assertIn("total rows: 4, agreed: 1, to review: 3", out)

    def test_decisions_columns_and_no_text(self):
        self.sheet(self.scenario())
        text = (self.dir / "lab" / "t-decisions.csv").read_text(encoding="utf-8")
        self.assertEqual(text.splitlines()[0], ",".join(review.DECISION_COLUMNS))
        self.assertNotIn("SECRETTEXT", text)
        self.assertEqual(self.decisions()[0]["decision"], "")

    def test_sheet_has_turn_text_and_model(self):
        run = {"dialogs": [{"conversationId": "d1", "ratings": [{"criterionId": "understanding", "answer": "yes"}]}]}
        (self.dir / "run.json").write_text(json.dumps(run), encoding="utf-8")
        self.run_cli("sheet", "--labels", *self.scenario(), "--set", "d1", "--name", "t", "--run",
                     str(self.dir / "run.json"), "--runs-dir", str(self.dir / "runs"),
                     "--labels-dir", str(self.dir / "lab"))
        md = (self.dir / "runs" / "t-review.md").read_text(encoding="utf-8")
        self.assertIn("[1] client: hello SECRETTEXT", md)
        self.assertIn("[2] bot: hi there", md)
        self.assertIn("model, for context only: yes", md)

    def test_chats17(self):
        sets = json.loads((Path(review.__file__).parent / "labels" / "sets.json").read_text(encoding="utf-8"))
        ids = review.resolve_set("chats17", sets)
        self.assertEqual(len(ids), 17)
        self.assertFalse(any(i.startswith("p4-") for i in ids))

    def test_not_two_labelers(self):
        for a, b in (("A", "A"), ("A", "C")):
            files = self.files([line("d1", a, "opening", "yes")], [line("d1", b, "closing", "yes")])
            if a == b:
                files = files[:1]
            else:
                files.append(self.write("c.csv", [line("d1", "B", "opening", "yes")]))
            code, _, err = self.sheet(files)
            self.assertEqual(code, 1)
            self.assertIn("exactly two labelers", err)

    def finalize(self, decisions_rows, *extra):
        self.sheet(self.scenario())
        path = self.dir / "lab" / "t-decisions.csv"
        rows = self.decisions()
        for r, d in zip(rows, decisions_rows):
            r.update(d)
        with open(path, "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, review.DECISION_COLUMNS)
            w.writeheader()
            w.writerows(rows)
        out = self.dir / "final.csv"
        code, stdout, err = self.run_cli("finalize", "--labels", *self.scenario(), "--decisions", str(path),
                                         "--set", "d1", "--out", str(out), *extra)
        return code, stdout, err, out

    def final_rows(self, out):
        with open(out, encoding="utf-8", newline="") as f:
            return {r["criterion_id"]: r for r in csv.DictReader(f)}

    def test_finalize_all_decided_and_evidence(self):
        d = [{"decision": "no", "reviewer": "me", "reason": "r"}, {"decision": "no", "reviewer": "me"},
             {"decision": "na", "reviewer": "me"}]
        code, stdout, _, out = self.finalize(d)
        self.assertEqual(code, 0)
        self.assertIn("agreed: 1, decided: 3, pending: 0", stdout)
        rows = self.final_rows(out)
        self.assertEqual(rows["opening"]["evidence_turns"], "1;2")
        self.assertEqual(rows["opening"]["note"], "ai-agreed")
        self.assertEqual(rows["understanding"]["evidence_turns"], "1")
        self.assertEqual(rows["understanding"]["note"], "human: me: r")
        self.assertEqual(rows[CRITS[2]]["evidence_turns"], "3")
        self.assertEqual(rows[CRITS[3]]["evidence_turns"], "")
        self.assertEqual({r["labeler"] for r in rows.values()}, {"final"})

    def test_finalize_invalid_decision(self):
        code, _, err, out = self.finalize([{"decision": "maybe"}] * 3)
        self.assertEqual(code, 1)
        self.assertIn("'maybe' not allowed", err)
        self.assertFalse(out.exists())

    def test_finalize_pending(self):
        d = [{"decision": "no"}]
        code, _, err, out = self.finalize(d)
        self.assertEqual(code, 1)
        self.assertIn("decision missing", err)
        code, stdout, _, out = self.finalize(d, "--allow-pending")
        self.assertEqual(code, 0)
        self.assertIn("agreed: 1, decided: 1, pending: 2", stdout)
        self.assertEqual(set(self.final_rows(out)), {"opening", "understanding"})


if __name__ == "__main__":
    unittest.main()
