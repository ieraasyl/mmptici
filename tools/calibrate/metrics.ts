// Pure agreement metrics.

export function cohenKappa<T>(a: T[], b: T[]): number | null {
  const n = a.length;
  if (n === 0) return null;
  const observed = a.filter((x, i) => x === b[i]).length / n;
  const count = (xs: T[]) => {
    const m = new Map<T, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
  };
  const [ca, cb] = [count(a), count(b)];
  let expected = 0;
  for (const [k, v] of ca) expected += v * (cb.get(k) ?? 0);
  expected /= n * n;
  if (expected === 1) return null;
  return (observed - expected) / (1 - expected);
}

export function quadraticWeightedKappa<T>(a: T[], b: T[], categories: T[]): number | null {
  const n = a.length;
  const k = categories.length;
  if (n === 0 || k < 2) return null;
  const index = new Map(categories.map((c, i) => [c, i]));
  const observed = categories.map(() => categories.map(() => 0));
  a.forEach((x, i) => observed[index.get(x)!][index.get(b[i])!]++);
  const row = observed.map((r) => r.reduce((s, v) => s + v, 0));
  const col = categories.map((_, j) => observed.reduce((s, r) => s + r[j], 0));
  let num = 0;
  let den = 0;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      const w = (i - j) ** 2 / (k - 1) ** 2;
      num += w * observed[i][j];
      den += (w * row[i] * col[j]) / n;
    }
  }
  if (den === 0) return null;
  return 1 - num / den;
}

/**
 * Mersenne Twister seeded and sampled like Python's random.Random(seed).choice, so bootstrap
 * intervals are deterministic per seed and match the earlier Python reports.
 */
export class PyRandom {
  private mt = new Uint32Array(624);
  private index = 624;

  constructor(seed: number) {
    let n = BigInt(Math.abs(Math.trunc(seed)));
    const key: number[] = [];
    while (n > 0n) {
      key.push(Number(n & 0xffffffffn));
      n >>= 32n;
    }
    this.initByArray(key.length ? key : [0]);
  }

  private initGenrand(s: number) {
    const mt = this.mt;
    mt[0] = s >>> 0;
    for (let i = 1; i < 624; i++) {
      const prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = (Math.imul(1812433253, prev) + i) >>> 0;
    }
    this.index = 624;
  }

  private initByArray(key: number[]) {
    const mt = this.mt;
    this.initGenrand(19650218);
    let i = 1;
    let j = 0;
    for (let k = Math.max(624, key.length); k; k--) {
      const prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = ((mt[i] ^ Math.imul(prev, 1664525)) + key[j] + j) >>> 0;
      i++;
      j++;
      if (i >= 624) {
        mt[0] = mt[623];
        i = 1;
      }
      if (j >= key.length) j = 0;
    }
    for (let k = 623; k; k--) {
      const prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = ((mt[i] ^ Math.imul(prev, 1566083941)) - i) >>> 0;
      i++;
      if (i >= 624) {
        mt[0] = mt[623];
        i = 1;
      }
    }
    mt[0] = 0x80000000;
  }

  private next32(): number {
    const mt = this.mt;
    if (this.index >= 624) {
      for (let kk = 0; kk < 624; kk++) {
        const y = (mt[kk] & 0x80000000) | (mt[(kk + 1) % 624] & 0x7fffffff);
        mt[kk] = mt[(kk + 397) % 624] ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0);
      }
      this.index = 0;
    }
    let y = mt[this.index++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  /** Uniform integer in [0, n) for n below 2^32, by rejection like Python's _randbelow. */
  below(n: number): number {
    const k = Math.floor(Math.log2(n)) + 1;
    for (;;) {
      const r = this.next32() >>> (32 - k);
      if (r < n) return r;
    }
  }

  choice<T>(items: T[]): T {
    return items[this.below(items.length)];
  }
}

/** 95% percentile interval (nearest rank) of statistic over resampled units. */
export function bootstrapCi<T>(
  units: T[],
  statistic: (sample: T[]) => number | null,
  n = 1000,
  seed = 0,
): [number, number] | null {
  if (units.length === 0) return null;
  const rng = new PyRandom(seed);
  const stats: number[] = [];
  for (let i = 0; i < n; i++) {
    const value = statistic(units.map(() => rng.choice(units)));
    if (value !== null) stats.push(value);
  }
  if (stats.length === 0) return null;
  stats.sort((x, y) => x - y);
  const rank = (q: number) => stats[Math.max(Math.ceil(q * stats.length) - 1, 0)];
  return [rank(0.025), rank(0.975)];
}

/** a is the reference, b the prediction. */
export function precisionRecall<T>(a: T[], b: T[], positive: T = "yes" as T) {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  a.forEach((x, i) => {
    const y = b[i];
    if (x === positive && y === positive) tp++;
    if (x !== positive && y === positive) fp++;
    if (x === positive && y !== positive) fn++;
  });
  return {
    tp,
    fp,
    fn,
    precision: tp + fp ? tp / (tp + fp) : null,
    recall: tp + fn ? tp / (tp + fn) : null,
  };
}
