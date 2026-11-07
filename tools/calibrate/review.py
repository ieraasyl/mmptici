"""Build a human review sheet from two labelers' disagreements, then merge into final labels."""

import argparse
import csv
import sys
from pathlib import Path

from compare import (DEFAULT_DATA, DEFAULT_RUNS, DEFAULT_SETS, _turns, check_labels, check_run,
                     load_json, normalize, read_labels, run_ratings)
from score import allowed_answers, load_checklist

HERE = Path(__file__).resolve().parent
DEFAULT_LABELS_DIR = HERE / "labels"
DECISION_COLUMNS = ["conversation_id", "criterion_id", "a_labeler", "a_answer", "b_labeler",
                    "b_answer", "decision", "reviewer", "reason"]
LABEL_COLUMNS = ["conversation_id", "labeler", "criterion_id", "answer", "evidence_turns", "note"]


def resolve_set(spec, sets) -> list[str]:
    """Dialog IDs in set order. chats17 = tuning + heldout without the p4- voice calls."""
    if spec in ("tuning", "heldout"):
        return list(sets[spec])
    if spec == "chats17":
        return [c for c in sets["tuning"] + sets["heldout"] if not c.startswith("p4-")]
    return [s.strip() for s in spec.split(",") if s.strip()]


def two_labelers(rows) -> tuple[str, str]:
    names = sorted({r["labeler"] for r in rows})
    if len(names) != 2:
        raise ValueError(f"expected exactly two labelers, found {len(names)}: {', '.join(names) or 'none'}")
    return names[0], names[1]


def classify(rows, a_name, b_name, convs, checklist) -> list[dict]:
    """One entry per (dialog, criterion) labeled by at least one labeler, in set/checklist order."""
    by = {(r["conversation_id"], r["labeler"], r["criterion_id"]): r for r in rows}
    out = []
    for conv in convs:
        for c in checklist["criteria"]:
            a, b = by.get((conv, a_name, c["id"])), by.get((conv, b_name, c["id"]))
            if not a and not b:
                continue
            unsure = any(r and r["note"].upper().startswith("UNSURE:") for r in (a, b))
            agreed = bool(a and b) and a["answer"] == b["answer"] and not unsure
            out.append({"conv": conv, "cid": c["id"], "a": a, "b": b, "agreed": agreed})
    return out


def load_rows(paths, checklist, records):
    rows = [r for p in paths for r in read_labels(p)]
    problems = check_labels(rows, checklist, {r["conversation_id"] for r in records})
    if problems:
        raise ValueError("\n".join(problems))
    return rows, two_labelers(rows)


def _answer(r):
    return "" if r is None else r["answer"]


def _fmt_labeler(name, r):
    if r is None:
        return f"{name}: (missing)"
    turns = ";".join(map(str, _turns(r["evidence_turns"]))) or "-"
    return f"{name}: {r['answer']} | turns {turns} | note: {r['note'] or '-'}"


def render_sheet(name, entries, a_name, b_name, convs, records, checklist, ratings) -> str:
    info = {r["conversation_id"]: r for r in records}
    crit = {c["id"]: c for c in checklist["criteria"]}
    L = [f"# Review sheet: {name}", "", f"Labelers: A={a_name}, B={b_name}", ""]
    for conv in convs:
        todo = [e for e in entries if e["conv"] == conv and not e["agreed"]]
        if not todo:
            continue
        transcript = info[conv]["transcript"]
        L += [f"## {conv} ({info[conv]['language']})", ""]
        for e in todo:
            c = crit[e["cid"]]
            L += [f"### {c['id']}: {c['title']}", "",
                  f"- Allowed answers: {', '.join(map(str, allowed_answers(c)))}",
                  f"- {_fmt_labeler(a_name, e['a'])}", f"- {_fmt_labeler(b_name, e['b'])}"]
            if ratings is not None:
                m = ratings.get(conv, {}).get(e["cid"])
                L.append(f"- model, for context only: {m['answer'] if m else '(none)'}")
            cited = sorted({t for r in (e["a"], e["b"]) if r for t in _turns(r["evidence_turns"])})
            for t in cited:
                if 1 <= t <= len(transcript):
                    L.append(f"  - [{t}] {transcript[t - 1]['speaker']}: {transcript[t - 1]['text']}")
                else:
                    L.append(f"  - [{t}] (no such turn)")
            L.append("")
    return "\n".join(L)


def write_csv(path, columns, rows):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(columns)
        w.writerows(rows)


def cmd_sheet(args, checklist, records, sets) -> int:
    rows, (a_name, b_name) = load_rows(args.labels, checklist, records)
    convs = resolve_set(args.set_spec, sets)
    ratings = None
    if args.run:
        ratings = run_ratings(load_json(args.run))
        problems = check_run(ratings, checklist, {r["conversation_id"] for r in records})
        if problems:
            raise ValueError("\n".join(problems))
    entries = classify(rows, a_name, b_name, convs, checklist)
    review = [e for e in entries if not e["agreed"]]
    runs, labels = Path(args.runs_dir), Path(args.labels_dir)
    runs.mkdir(parents=True, exist_ok=True)
    labels.mkdir(parents=True, exist_ok=True)
    sheet = runs / f"{args.name}-review.md"
    decisions = labels / f"{args.name}-decisions.csv"
    sheet.write_text(render_sheet(args.name, entries, a_name, b_name, convs, records, checklist, ratings),
                     encoding="utf-8")
    write_csv(decisions, DECISION_COLUMNS,
              [[e["conv"], e["cid"], a_name, _answer(e["a"]), b_name, _answer(e["b"]), "", "", ""]
               for e in review])
    print(sheet)
    print(decisions)
    print(f"total rows: {len(entries)}, agreed: {len(entries) - len(review)}, to review: {len(review)}")
    for c in checklist["criteria"]:
        n = sum(e["cid"] == c["id"] for e in review)
        total = sum(e["cid"] == c["id"] for e in entries)
        print(f"  {c['id']}: {n} to review of {total}")
    return 0


def _union(*rows):
    return sorted({t for r in rows if r for t in _turns(r["evidence_turns"])})


def cmd_finalize(args, checklist, records, sets) -> int:
    rows, (a_name, b_name) = load_rows(args.labels, checklist, records)
    convs = resolve_set(args.set_spec, sets)
    crit = {c["id"]: c for c in checklist["criteria"]}
    with open(args.decisions, encoding="utf-8-sig", newline="") as f:
        decisions = {(d["conversation_id"].strip(), d["criterion_id"].strip()): {k: (v or "").strip() for k, v in d.items() if k}
                     for d in csv.DictReader(f)}
    problems, pending, out = [], [], []
    agreed = decided = 0
    for e in classify(rows, a_name, b_name, convs, checklist):
        key = (e["conv"], e["cid"])
        if e["agreed"]:
            agreed += 1
            out.append([e["conv"], "final", e["cid"], e["a"]["answer"], ";".join(map(str, _union(e["a"], e["b"]))),
                        "ai-agreed"])
            continue
        d = decisions.get(key)
        if not d or not d.get("decision"):
            pending.append(key)
            continue
        answer = normalize(d["decision"])
        if answer not in allowed_answers(crit[e["cid"]]):
            problems.append(f"{key[0]} {key[1]}: decision {d['decision']!r} not allowed")
            continue
        support = [r for r in (e["a"], e["b"]) if r and r["answer"] == answer]
        decided += 1
        out.append([e["conv"], "final", e["cid"], answer, ";".join(map(str, _union(*support))),
                    f"human: {d.get('reviewer', '')}: {d.get('reason', '')}"])
    if pending and not args.allow_pending:
        problems += [f"{c} {k}: decision missing" for c, k in pending]
    if problems:
        print("\n".join(problems), file=sys.stderr)
        return 1
    write_csv(args.out, LABEL_COLUMNS, out)
    print(args.out)
    print(f"agreed: {agreed}, decided: {decided}, pending: {len(pending)}")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("sheet", "finalize"):
        p = sub.add_parser(name)
        p.add_argument("--labels", nargs="+", required=True)
        p.add_argument("--set", required=True, dest="set_spec")
        p.add_argument("--sets", default=str(DEFAULT_SETS))
        p.add_argument("--checklist", default=None)
        p.add_argument("--data", default=str(DEFAULT_DATA))
        if name == "sheet":
            p.add_argument("--run")
            p.add_argument("--name", required=True)
            p.add_argument("--runs-dir", default=str(DEFAULT_RUNS))
            p.add_argument("--labels-dir", default=str(DEFAULT_LABELS_DIR))
        else:
            p.add_argument("--decisions", required=True)
            p.add_argument("--out", required=True)
            p.add_argument("--allow-pending", action="store_true")
    args = ap.parse_args(argv)
    checklist = load_checklist(args.checklist)
    records = load_json(args.data)["data"]["records"]
    sets = load_json(args.sets)
    try:
        return (cmd_sheet if args.cmd == "sheet" else cmd_finalize)(args, checklist, records, sets)
    except ValueError as e:
        print(e, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
