"""Compare labels against labels (--pairs) or against an LLM run (--run)."""

import argparse
import csv
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from metrics import bootstrap_ci, cohen_kappa, precision_recall, quadratic_weighted_kappa
from score import allowed_answers, load_checklist, score

HERE = Path(__file__).resolve().parent
DEFAULT_LABELS = HERE / "labels" / "labels.csv"
DEFAULT_SETS = HERE / "labels" / "sets.json"
DEFAULT_DATA = HERE.parents[1] / "data" / "invoke.json"
DEFAULT_REPORTS = HERE / "reports"
DEFAULT_RUNS = HERE / "runs"
LANGUAGES = ["RU", "KZ", "EN"]
CHANNELS = ["agent chat", "voice call"]
CSV_COLUMNS = ["conversation_id", "criterion_id", "a", "b", "votes", "explanation",
               "a_note", "evidence_turns", "evidence_text", "bucket"]


def normalize(answer):
    if isinstance(answer, int) and not isinstance(answer, bool):
        return answer
    text = str(answer).strip().lower()
    if text == "n/a":
        return "na"
    return int(text) if text.isdigit() else text


def read_labels(path) -> list[dict]:
    with open(path, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    for i, row in enumerate(rows, start=2):
        row["row"] = i
        row["answer"] = normalize(row["answer"])
    return rows


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def check_labels(rows, checklist, conversations) -> list[str]:
    criteria = {c["id"]: c for c in checklist["criteria"]}
    problems, seen = [], set()
    for r in rows:
        n, cid = r["row"], r["criterion_id"]
        if r["conversation_id"] not in conversations:
            problems.append(f"row {n}: unknown conversation {r['conversation_id']!r}")
        if cid not in criteria:
            problems.append(f"row {n}: unknown criterion {cid!r}")
        elif r["answer"] not in allowed_answers(criteria[cid]):
            problems.append(f"row {n}: answer {r['answer']!r} not allowed for {cid}")
        key = (r["conversation_id"], r["labeler"], cid)
        if key in seen:
            problems.append(f"row {n}: duplicate label for {key}")
        seen.add(key)
    return problems


def run_ratings(run: dict) -> dict:
    """{conversationId: {criterionId: rating with normalized answer}}"""
    out = {}
    for d in run["dialogs"]:
        out[d["conversationId"]] = {
            r["criterionId"]: {**r, "answer": normalize(r["answer"])} for r in d["ratings"]
        }
    return out


def check_run(ratings, checklist, conversations) -> list[str]:
    criteria = {c["id"]: c for c in checklist["criteria"]}
    problems = []
    for conv, by_crit in ratings.items():
        if conv not in conversations:
            problems.append(f"run dialog {conv}: unknown conversation")
        for cid, r in by_crit.items():
            if cid not in criteria:
                problems.append(f"run dialog {conv}: unknown criterion {cid!r}")
            elif r["answer"] not in allowed_answers(criteria[cid]):
                problems.append(f"run dialog {conv}: answer {r['answer']!r} not allowed for {cid}")
    return problems


def select_conversations(spec, sets, available) -> list[str]:
    if spec == "all":
        chosen = set(available)
    elif spec in ("tuning", "heldout"):
        chosen = set(sets[spec]) & set(available)
    else:
        chosen = set(s.strip() for s in spec.split(",") if s.strip()) & set(available)
    return sorted(chosen)


def _turns(text) -> list[int]:
    return [int(t) for t in re.findall(r"\d+", text or "")]


def _votes_text(votes) -> str:
    parts = []
    for v in votes or []:
        if isinstance(v, dict):
            parts.append(f"{v.get('answer')}@{v.get('model')}" if v.get("model") else str(v.get("answer")))
        else:
            parts.append(str(v))
    return ";".join(parts)


def build_pairs(mode, rows, set_spec, sets, labeler="final", ratings=None):
    """Returns (pair records, labelerA, labelerB, conversations, answers by side)."""
    by_conv = defaultdict(lambda: defaultdict(dict))
    for r in rows:
        by_conv[r["conversation_id"]][r["labeler"]][r["criterion_id"]] = r
    pairs, a_names, b_names = [], set(), set()
    if mode == "pairs":
        convs = select_conversations(set_spec, sets, by_conv)
        for conv in convs:
            names = sorted(n for n in by_conv[conv] if n != "final")
            if len(names) < 2:
                continue
            a_name, b_name = names[:2]
            a_names.add(a_name)
            b_names.add(b_name)
            a_rows, b_rows = by_conv[conv][a_name], by_conv[conv][b_name]
            for cid in a_rows.keys() & b_rows.keys():
                pairs.append({
                    "conv": conv, "cid": cid, "a": a_rows[cid]["answer"], "b": b_rows[cid]["answer"],
                    "a_note": a_rows[cid]["note"], "turns": _turns(b_rows[cid]["evidence_turns"]),
                    "votes": "", "explanation": "",
                })
    else:
        convs = select_conversations(set_spec, sets, [c for c in by_conv if labeler in by_conv[c]])
        a_names.add(labeler)
        for conv in convs:
            a_rows, b_rows = by_conv[conv][labeler], ratings.get(conv, {})
            for cid in a_rows.keys() & b_rows.keys():
                rating = b_rows[cid]
                pairs.append({
                    "conv": conv, "cid": cid, "a": a_rows[cid]["answer"], "b": rating["answer"],
                    "a_note": a_rows[cid]["note"], "turns": list(rating.get("evidence") or []),
                    "votes": _votes_text(rating.get("votes")),
                    "explanation": rating.get("explanation") or "",
                })
    return pairs, ",".join(sorted(a_names)), ",".join(sorted(b_names)), convs


def _exact(rows):
    return sum(p["a"] == p["b"] for p in rows)


def _rate(rows):
    return _exact(rows) / len(rows) if rows else None


def per_criterion(pairs, checklist) -> dict:
    out = {}
    for c in checklist["criteria"]:
        rows = [p for p in pairs if p["cid"] == c["id"]]
        a, b = [p["a"] for p in rows], [p["b"] for p in rows]
        entry = {"n": len(rows), "exact": _exact(rows), "exactRate": _rate(rows),
                 "kappa": cohen_kappa(a, b)}
        if c["kind"] == "numeric":
            kept = [p for p in rows if p["a"] != "na" and p["b"] != "na"]
            entry["qwk"] = quadratic_weighted_kappa(
                [p["a"] for p in kept], [p["b"] for p in kept], c["scale"])
        if c["allowNA"]:
            entry["naAgreement"] = (
                sum((p["a"] == "na") == (p["b"] == "na") for p in rows) / len(rows) if rows else None)
        confusion = defaultdict(lambda: defaultdict(int))
        for x, y in zip(a, b):
            confusion[str(x)][str(y)] += 1
        entry["confusion"] = {k: dict(v) for k, v in confusion.items()}
        out[c["id"]] = entry
    return out


def _by_dialog(pairs) -> list[list[dict]]:
    groups = defaultdict(list)
    for p in pairs:
        groups[p["conv"]].append(p)
    return [groups[k] for k in sorted(groups)]


def _pooled_rate(dialogs):
    rows = [p for d in dialogs for p in d]
    return _rate(rows)


def pooled(pairs) -> dict:
    ci = bootstrap_ci(_by_dialog(pairs), _pooled_rate)
    return {"n": len(pairs), "exact": _exact(pairs), "exactRate": _rate(pairs),
            "ci": list(ci) if ci else None}


def totals(pairs, checklist) -> dict:
    need = {c["id"] for c in checklist["criteria"]}
    errors, skipped = [], 0
    for d in _by_dialog(pairs):
        a = {p["cid"]: p["a"] for p in d}
        b = {p["cid"]: p["b"] for p in d}
        if not need <= a.keys() or not need <= b.keys():
            skipped += 1
            continue
        ta, tb = score(checklist, a)["total"], score(checklist, b)["total"]
        if ta is None or tb is None:
            skipped += 1
            continue
        errors.append(abs(ta - tb))
    mean = lambda xs: sum(xs) / len(xs) if xs else None
    ci = bootstrap_ci(errors, mean)
    return {"n": len(errors), "mae": mean(errors), "maxError": max(errors) if errors else None,
            "ci": list(ci) if ci else None, "skipped": skipped}


def breakdown(pairs, records) -> dict:
    info = {r["conversation_id"]: r for r in records}
    out = {}
    for field, values in (("language", LANGUAGES), ("channel", CHANNELS)):
        out[field] = {}
        for v in values:
            rows = [p for p in pairs if info.get(p["conv"], {}).get(field) == v]
            out[field][v] = {"n": len(rows), "exactRate": _rate(rows)}
    return out


def run_health(run, label_convs, ratings) -> dict:
    dialogs = run["dialogs"]
    meta = [d.get("run") or {} for d in dialogs]
    lat = [m["latencyMs"] for m in meta if m.get("latencyMs") is not None]
    return {
        "dialogs": len(dialogs),
        "failedSamples": sum(m.get("failedSamples") or 0 for m in meta),
        "meanLatencyMs": sum(lat) / len(lat) if lat else None,
        "costUsd": sum(m.get("costUsd") or 0 for m in meta),
        "missingFromRun": sorted(c for c in label_convs if c not in ratings),
    }


def build_report(args_mode, name, set_spec, labels_path, sets, checklist, records, run=None,
                 labeler="final") -> tuple[dict, list[dict]]:
    rows = read_labels(labels_path)
    conversations = {r["conversation_id"] for r in records}
    problems = check_labels(rows, checklist, conversations)
    ratings = run_ratings(run) if run else None
    if run:
        problems += check_run(ratings, checklist, conversations)
    if problems:
        raise ValueError("\n".join(problems))
    pairs, a_name, b_name, convs = build_pairs(args_mode, rows, set_spec, sets, labeler, ratings)
    violations = [p for p in pairs if p["cid"] == "violations"]
    mismatches = [p for p in pairs if p["a"] != p["b"]]
    report = {
        "name": name,
        "createdAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mode": args_mode,
        "set": set_spec,
        "labelerA": a_name,
        "perCriterion": per_criterion(pairs, checklist),
        "pooled": pooled(pairs),
        "totals": totals(pairs, checklist),
        "violations": precision_recall([p["a"] for p in violations], [p["b"] for p in violations]),
        "breakdown": breakdown(pairs, records),
        "runHealth": run_health(run, convs, ratings) if run else None,
        "mismatches": [{"conversationId": p["conv"], "criterionId": p["cid"], "a": p["a"], "b": p["b"]}
                       for p in mismatches],
    }
    if run:
        report["run"] = {k: run.get(k) for k in ("promptVersion", "provider", "model")}
    else:
        report["labelerB"] = b_name
    return report, mismatches


def write_mismatch_csv(path, mismatches, records):
    text = {r["conversation_id"]: r["transcript"] for r in records}
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(CSV_COLUMNS)
        for p in mismatches:
            transcript = text.get(p["conv"], [])
            quoted = " | ".join(transcript[t - 1]["text"] for t in p["turns"] if 1 <= t <= len(transcript))
            w.writerow([p["conv"], p["cid"], p["a"], p["b"], p["votes"], p["explanation"], p["a_note"],
                        ";".join(map(str, p["turns"])), quoted, ""])


def _f(x):
    return "-" if x is None else f"{x:.3f}"


def render_md(r) -> str:
    L = [f"# Comparison report: {r['name']}", "",
         f"- Created: {r['createdAt']}", f"- Mode: {r['mode']}", f"- Set: {r['set']}",
         f"- Labeler A: {r['labelerA']}"]
    L.append(f"- Run: {r['run']}" if "run" in r else f"- Labeler B: {r['labelerB']}")
    L += ["", "## Per criterion", "",
          "| criterion | n | exact | exact rate | kappa | qwk | NA agreement |", "|---|---|---|---|---|---|---|"]
    for cid, c in r["perCriterion"].items():
        L.append(f"| {cid} | {c['n']} | {c['exact']} | {_f(c['exactRate'])} | {_f(c['kappa'])} | "
                 f"{_f(c.get('qwk'))} | {_f(c.get('naAgreement'))} |")
    for cid, c in r["perCriterion"].items():
        L += ["", f"Confusion {cid} (A rows, B columns): `{json.dumps(c['confusion'], sort_keys=True)}`"]
    p, t, v = r["pooled"], r["totals"], r["violations"]
    L += ["", "## Pooled", "", f"- n: {p['n']}, exact: {p['exact']}, rate: {_f(p['exactRate'])}, "
          f"95% CI: {p['ci'] and [round(x, 3) for x in p['ci']]}",
          "", "## Totals", "", f"- n: {t['n']}, MAE: {_f(t['mae'])}, max error: {_f(t['maxError'])}, "
          f"95% CI: {t['ci'] and [round(x, 3) for x in t['ci']]}, skipped: {t['skipped']}",
          "", "## Violations", "", f"- tp: {v['tp']}, fp: {v['fp']}, fn: {v['fn']}, "
          f"precision: {_f(v['precision'])}, recall: {_f(v['recall'])}", "", "## Breakdown", "",
          "| group | value | n | exact rate |", "|---|---|---|---|"]
    for field, vals in r["breakdown"].items():
        for k, e in vals.items():
            L.append(f"| {field} | {k} | {e['n']} | {_f(e['exactRate'])} |")
    L += ["", "## Run health", ""]
    h = r["runHealth"]
    if h is None:
        L.append("Not applicable (pairs mode).")
    else:
        L += [f"- dialogs: {h['dialogs']}", f"- failed samples: {h['failedSamples']}",
              f"- mean latency ms: {h['meanLatencyMs']}", f"- cost USD: {h['costUsd']}",
              f"- missing from run: {', '.join(h['missingFromRun']) or 'none'}"]
    L += ["", "## Mismatches", "", f"Count: {len(r['mismatches'])}", ""]
    return "\n".join(L)


def main(argv=None, reports_dir=DEFAULT_REPORTS, runs_dir=DEFAULT_RUNS) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--labels", default=str(DEFAULT_LABELS))
    ap.add_argument("--sets", default=str(DEFAULT_SETS))
    ap.add_argument("--checklist", default=None)
    ap.add_argument("--data", default=str(DEFAULT_DATA))
    ap.add_argument("--set", default="all", dest="set_spec")
    ap.add_argument("--name", required=True)
    ap.add_argument("--labeler", default="final")
    ap.add_argument("--reports-dir", default=str(reports_dir))
    ap.add_argument("--runs-dir", default=str(runs_dir))
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--pairs", action="store_true")
    mode.add_argument("--run")
    args = ap.parse_args(argv)

    checklist = load_checklist(args.checklist)
    records = load_json(args.data)["data"]["records"]
    sets = load_json(args.sets)
    run = load_json(args.run) if args.run else None
    try:
        report, mismatches = build_report("run" if run else "pairs", args.name, args.set_spec,
                                          args.labels, sets, checklist, records, run, args.labeler)
    except ValueError as e:
        print(e, file=sys.stderr)
        return 1

    reports, runs = Path(args.reports_dir), Path(args.runs_dir)
    reports.mkdir(parents=True, exist_ok=True)
    runs.mkdir(parents=True, exist_ok=True)
    paths = [reports / f"{args.name}.json", reports / f"{args.name}.md", runs / f"{args.name}-mismatches.csv"]
    paths[0].write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    paths[1].write_text(render_md(report), encoding="utf-8")
    write_mismatch_csv(paths[2], mismatches, records)
    for p in paths:
        print(p)
    return 0


if __name__ == "__main__":
    sys.exit(main())
