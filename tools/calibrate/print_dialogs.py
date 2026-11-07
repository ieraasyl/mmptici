"""Print dialogs as Markdown labeling sheets and per-labeler CSV templates."""
import argparse
import csv
import json
import sys
from pathlib import Path

from score import allowed_answers, load_checklist

HEADER = ["conversation_id", "labeler", "criterion_id", "answer", "evidence_turns", "note"]


def load_records(path) -> dict:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return {r["conversation_id"]: r for r in data["data"]["records"]}


def load_sets(path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def set_name(sets: dict, cid: str) -> str:
    if cid in sets["tuning"]:
        return "tuning"
    if cid in sets["heldout"]:
        return "heldout"
    return "other"


def resolve_ids(spec: str, sets: dict) -> list:
    if spec == "tuning":
        return list(sets["tuning"])
    if spec == "heldout":
        return list(sets["heldout"])
    if spec == "all20":
        return list(sets["tuning"]) + list(sets["heldout"])
    return [s.strip() for s in spec.split(",") if s.strip()]


def render_dialog(record: dict, set_label: str, checklist: dict) -> str:
    cid = record["conversation_id"]
    lines = [f"# {cid}", "", f"{record['channel']} | {record['language']} | {set_label}", ""]
    for n, turn in enumerate(record["transcript"], 1):
        text = " ".join(turn["text"].splitlines())
        lines.append(f"[{n}] {turn['speaker']} {turn['timestamp']}: {text}")
    lines += ["", "| criterion_id | title | allowed answers | answer | evidence turns | note |",
              "| --- | --- | --- | --- | --- | --- |"]
    for c in checklist["criteria"]:
        allowed = "/".join(str(a) for a in allowed_answers(c))
        lines.append(f"| {c['id']} | {c['title']} | {allowed} |  |  |  |")
    return "\n".join(lines) + "\n"


def write_dialogs(ids, records, sets, checklist, out_dir) -> list:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    written = []
    for cid in ids:
        if cid not in records:
            raise KeyError(f"unknown conversation id: {cid}")
        path = out / f"{cid}.md"
        path.write_text(render_dialog(records[cid], set_name(sets, cid), checklist), encoding="utf-8")
        written.append(path)
    return written


def write_template(labeler, sets, checklist, out_dir) -> Path:
    if labeler not in sets["assignments"]:
        raise KeyError(labeler)
    a = sets["assignments"][labeler]
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    path = out / f"labels-{labeler}.csv"
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(HEADER)
        for cid in a["primary"] + a["second"]:
            for c in checklist["criteria"]:
                w.writerow([cid, labeler, c["id"], "", "", ""])
    return path


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--data", default="data/invoke.json")
    p.add_argument("--out", default="tools/calibrate/print")
    p.add_argument("--sets", default="tools/calibrate/labels/sets.json")
    p.add_argument("--checklist", default="tools/calibrate/checklist_default.json")
    p.add_argument("--set", dest="set_spec")
    p.add_argument("--template")
    args = p.parse_args(argv)
    if not args.set_spec and not args.template:
        p.error("give --set and/or --template")
    sets = load_sets(args.sets)
    checklist = load_checklist(args.checklist)
    written = []
    if args.set_spec:
        try:
            written += write_dialogs(resolve_ids(args.set_spec, sets), load_records(args.data),
                                     sets, checklist, args.out)
        except KeyError as e:
            print(e.args[0], file=sys.stderr)
            return 2
    if args.template:
        try:
            written.append(write_template(args.template, sets, checklist, args.out))
        except KeyError:
            known = ", ".join(sets["assignments"])
            print(f"unknown labeler: {args.template} (known: {known})", file=sys.stderr)
            return 2
    for path in written:
        print(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
