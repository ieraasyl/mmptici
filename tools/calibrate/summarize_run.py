"""Summarize a run file without labels: answer distribution, violation flags, stability, cost.

    python3 tools/calibrate/summarize_run.py tools/calibrate/runs/<run>.json --name <report-name>

Writes tools/calibrate/reports/<name>.md and .json. Reports hold IDs, answers, and counts only.
"""

import argparse
import json
import os
import statistics
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
REPORTS_DIR = os.path.join(HERE, "reports")

# Dialogs where reading the DEV set shows a gross violation (team observation, not organizer labels).
KNOWN_VIOLATIONS = {"p1-ru-022", "p1-ru-023", "p1-ru-029", "p1-kz-013", "p1-en-013"}


def answer_key(answer):
    return str(answer)


def summarize(run):
    dialogs = run["dialogs"]
    evaluated = [d for d in dialogs if d.get("ratings")]
    failed = sorted(d["conversationId"] for d in dialogs if not d.get("ratings"))

    distribution = defaultdict(Counter)
    by_language = defaultdict(lambda: defaultdict(Counter))
    stability = defaultdict(lambda: {"n": 0, "unanimous": 0})
    flagged = set()
    for d in evaluated:
        lang = d.get("language", "?")
        for r in d["ratings"]:
            cid = r["criterionId"]
            key = answer_key(r["answer"])
            distribution[cid][key] += 1
            by_language[cid][lang][key] += 1
            votes = r.get("votes") or []
            if len(votes) > 1:
                stability[cid]["n"] += 1
                if len({answer_key(v) for v in votes}) == 1:
                    stability[cid]["unanimous"] += 1
            if cid == "violations" and r["answer"] == "yes":
                flagged.add(d["conversationId"])

    present = {d["conversationId"] for d in evaluated}
    known_here = KNOWN_VIOLATIONS & present
    totals = [d["total"] for d in evaluated if d.get("total") is not None]
    latencies = [d["run"]["latencyMs"] for d in dialogs if d.get("run")]
    return {
        "run": {k: run.get(k) for k in ("promptVersion", "provider", "model", "set", "samples", "temperature", "commit")},
        "dialogs": len(dialogs),
        "evaluated": len(evaluated),
        "failed": failed,
        "distribution": {c: dict(v) for c, v in distribution.items()},
        "byLanguage": {c: {lang: dict(v) for lang, v in langs.items()} for c, langs in by_language.items()},
        "stability": {
            c: {**v, "rate": v["unanimous"] / v["n"] if v["n"] else None} for c, v in stability.items()
        }
        or None,
        "violations": {
            "flagged": sorted(flagged),
            "knownCaught": sorted(known_here & flagged),
            "knownMissed": sorted(known_here - flagged),
            "unexpected": sorted(flagged - KNOWN_VIOLATIONS),
        },
        "totals": {
            "n": len(totals),
            "mean": round(statistics.mean(totals), 2) if totals else None,
            "min": min(totals) if totals else None,
            "max": max(totals) if totals else None,
        },
        "cost": {
            "totalUsd": round(sum(d["run"]["costUsd"] for d in dialogs if d.get("run")), 4),
            "meanLatencyS": round(statistics.mean(latencies) / 1000, 2) if latencies else None,
            "calls": sum(d["run"].get("calls", 0) for d in dialogs if d.get("run")),
        },
    }


def render_md(name, s):
    lines = [f"# Run summary: {name}", ""]
    r = s["run"]
    lines.append(
        f"Prompt `{r['promptVersion']}` · {r['model']} · set `{r['set']}` · "
        f"{r['samples']} sample(s) at T={r['temperature']} · commit {r['commit']}"
    )
    lines += ["", f"Evaluated {s['evaluated']} of {s['dialogs']}. Failed: {', '.join(s['failed']) or 'none'}.", ""]
    lines += ["## Answers per criterion", "", "| Criterion | Answers |", "| --- | --- |"]
    for cid, counts in s["distribution"].items():
        cells = ", ".join(f"{a}: {n}" for a, n in sorted(counts.items(), key=lambda kv: -kv[1]))
        lines.append(f"| {cid} | {cells} |")
    lines += ["", "## Answers per criterion and language", "", "| Criterion | Language | Answers |", "| --- | --- | --- |"]
    for cid, langs in s["byLanguage"].items():
        for lang, counts in sorted(langs.items()):
            cells = ", ".join(f"{a}: {n}" for a, n in sorted(counts.items(), key=lambda kv: -kv[1]))
            lines.append(f"| {cid} | {lang} | {cells} |")
    if s["stability"]:
        lines += ["", "## Agreement between samples", "", "| Criterion | Unanimous | Of | Rate |", "| --- | ---: | ---: | ---: |"]
        for cid, v in s["stability"].items():
            rate = f"{v['rate']:.2f}" if v["rate"] is not None else "n/a"
            lines.append(f"| {cid} | {v['unanimous']} | {v['n']} | {rate} |")
    v = s["violations"]
    lines += [
        "",
        "## Gross violation flag",
        "",
        f"- Flagged: {', '.join(v['flagged']) or 'none'}",
        f"- Known cases caught: {', '.join(v['knownCaught']) or 'none'}",
        f"- Known cases missed: {', '.join(v['knownMissed']) or 'none'}",
        f"- Flagged but not a known case: {', '.join(v['unexpected']) or 'none'}",
    ]
    t, c = s["totals"], s["cost"]
    lines += [
        "",
        "## Totals and cost",
        "",
        f"- Totals: n={t['n']}, mean {t['mean']}, min {t['min']}, max {t['max']}",
        f"- Cost ${c['totalUsd']} over {c['calls']} model calls, mean {c['meanLatencyS']} s per dialog",
        "",
    ]
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Summarize a run file without labels.")
    parser.add_argument("run")
    parser.add_argument("--name", required=True)
    parser.add_argument("--reports-dir", default=REPORTS_DIR)
    args = parser.parse_args(argv)
    with open(args.run, encoding="utf-8") as f:
        run = json.load(f)
    summary = summarize(run)
    os.makedirs(args.reports_dir, exist_ok=True)
    json_path = os.path.join(args.reports_dir, f"{args.name}.json")
    md_path = os.path.join(args.reports_dir, f"{args.name}.md")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"name": args.name, **summary}, f, ensure_ascii=False, indent=2)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(render_md(args.name, summary))
    print(json_path)
    print(md_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
