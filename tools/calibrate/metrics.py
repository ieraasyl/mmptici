"""Pure agreement metrics (standard library only)."""

import math
import random
from collections import Counter


def cohen_kappa(a: list, b: list):
    n = len(a)
    if n == 0:
        return None
    observed = sum(x == y for x, y in zip(a, b)) / n
    ca, cb = Counter(a), Counter(b)
    expected = sum(ca[k] * cb[k] for k in ca) / (n * n)
    if expected == 1:
        return None
    return (observed - expected) / (1 - expected)


def quadratic_weighted_kappa(a: list, b: list, categories: list):
    n = len(a)
    k = len(categories)
    if n == 0 or k < 2:
        return None
    index = {c: i for i, c in enumerate(categories)}
    observed = [[0] * k for _ in range(k)]
    for x, y in zip(a, b):
        observed[index[x]][index[y]] += 1
    row = [sum(r) for r in observed]
    col = [sum(r[j] for r in observed) for j in range(k)]
    num = den = 0.0
    for i in range(k):
        for j in range(k):
            w = (i - j) ** 2 / (k - 1) ** 2
            num += w * observed[i][j]
            den += w * row[i] * col[j] / n
    if den == 0:
        return None
    return 1 - num / den


def bootstrap_ci(units: list, statistic, n: int = 1000, seed: int = 0):
    """95% percentile interval (nearest rank) of statistic(resampled units)."""
    if not units:
        return None
    rng = random.Random(seed)
    stats = []
    for _ in range(n):
        value = statistic([rng.choice(units) for _ in units])
        if value is not None:
            stats.append(value)
    if not stats:
        return None
    stats.sort()
    lo = stats[max(math.ceil(0.025 * len(stats)) - 1, 0)]
    hi = stats[max(math.ceil(0.975 * len(stats)) - 1, 0)]
    return (lo, hi)


def precision_recall(a: list, b: list, positive="yes") -> dict:
    """a is the reference, b the prediction."""
    tp = sum(x == positive and y == positive for x, y in zip(a, b))
    fp = sum(x != positive and y == positive for x, y in zip(a, b))
    fn = sum(x == positive and y != positive for x, y in zip(a, b))
    return {
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "precision": tp / (tp + fp) if tp + fp else None,
        "recall": tp / (tp + fn) if tp + fn else None,
    }
