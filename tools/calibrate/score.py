"""Python port of scoreEvaluation in apps/api/src/evaluation.ts."""

import json
import math
from pathlib import Path

DEFAULT_CHECKLIST = Path(__file__).with_name("checklist_default.json")


def load_checklist(path=None) -> dict:
    with open(path or DEFAULT_CHECKLIST, encoding="utf-8") as f:
        return json.load(f)


def allowed_answers(criterion: dict) -> list:
    answers = list(criterion["scale"]) if criterion["kind"] == "numeric" else ["yes", "no"]
    if criterion["allowNA"]:
        answers.append("na")
    return answers


def points(criterion: dict, answer):
    if criterion["kind"] == "flag" or answer == "na":
        return None
    if isinstance(answer, (int, float)):
        return answer / max(criterion["scale"]) * criterion["weight"]
    return criterion["weight"] if answer == "yes" else 0


def percentage(earned, weight):
    """Mirror of Math.round((earned / weight) * 10_000) / 100."""
    if weight == 0:
        return None
    return math.floor((earned / weight) * 10000 + 0.5) / 100


def _check(criterion: dict, answer) -> None:
    if answer not in allowed_answers(criterion):
        raise ValueError(f"criterion {criterion['id']!r}: answer {answer!r} is not allowed")


def score(checklist: dict, answers: dict, decisions: dict | None = None) -> dict:
    decisions = decisions or {}
    sections: dict[str, dict] = {}
    total_weight = 0
    total_earned = 0
    criteria = []
    serious = False

    for criterion in checklist["criteria"]:
        cid = criterion["id"]
        if cid not in answers:
            raise ValueError(f"criterion {cid!r}: answer is missing")
        original = answers[cid]
        _check(criterion, original)
        final = decisions.get(cid, original)
        _check(criterion, final)
        final_points = points(criterion, final)
        if criterion["kind"] == "flag":
            serious = serious or final == "yes"
        else:
            section = sections.setdefault(criterion["section"], {"weight": 0, "earned": 0})
            if final_points is not None:
                section["weight"] += criterion["weight"]
                section["earned"] += final_points
                total_weight += criterion["weight"]
                total_earned += final_points
        criteria.append({
            "id": cid,
            "original": original,
            "final": final,
            "originalPoints": points(criterion, original),
            "finalPoints": final_points,
        })

    return {
        "total": percentage(total_earned, total_weight),
        "seriousViolation": serious,
        "sections": [
            {"name": name, **v, "score": percentage(v["earned"], v["weight"])}
            for name, v in sections.items()
        ],
        "criteria": criteria,
    }
