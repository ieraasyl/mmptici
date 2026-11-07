import { describe, expect, test } from "vite-plus/test";
import {
  bootstrapCi,
  cohenKappa,
  precisionRecall,
  PyRandom,
  quadraticWeightedKappa,
} from "./metrics.ts";

describe("kappa", () => {
  test("nominal", () => {
    // po = 3/4; pe = (2*1 + 2*3)/16 = 0.5; kappa = 0.25/0.5
    expect(cohenKappa(["yes", "yes", "no", "no"], ["yes", "no", "no", "no"])).toBe(0.5);
  });

  test("identical and degenerate", () => {
    expect(cohenKappa(["yes", "no"], ["yes", "no"])).toBe(1);
    expect(cohenKappa(["yes", "yes"], ["yes", "yes"])).toBeNull();
    expect(cohenKappa([], [])).toBeNull();
  });

  test("quadratic weighted", () => {
    const cats = [0, 5, 10, 15, 20];
    expect(quadraticWeightedKappa([0, 20], [20, 0], cats)).toBe(-1);
    expect(quadraticWeightedKappa([0, 20, 10], [0, 20, 10], cats)).toBe(1);
    expect(quadraticWeightedKappa([], [], cats)).toBeNull();
    expect(quadraticWeightedKappa([5, 5], [5, 5], cats)).toBeNull();
  });
});

describe("bootstrap", () => {
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

  test("deterministic and contains the estimate", () => {
    const units = [1, 0, 1, 1, 0, 1, 1, 1];
    const ci = bootstrapCi(units, mean, 200, 3)!;
    expect(ci).toEqual(bootstrapCi(units, mean, 200, 3));
    expect(ci[0]).toBeLessThanOrEqual(mean(units));
    expect(ci[1]).toBeGreaterThanOrEqual(mean(units));
  });

  test("empty", () => {
    expect(bootstrapCi([], () => 0)).toBeNull();
  });

  test("the generator matches Python's random.Random", () => {
    // [random.Random(0).choice(range(10)) for _ in range(10)] and the same for seed 3.
    const draw = (seed: number) => {
      const rng = new PyRandom(seed);
      return Array.from({ length: 10 }, () => rng.below(10));
    };
    expect(draw(0)).toEqual([6, 6, 0, 4, 8, 7, 6, 4, 7, 5]);
    expect(draw(3)).toEqual([3, 9, 8, 2, 5, 9, 7, 9, 1, 9]);
  });
});

describe("precision and recall", () => {
  test("hand case", () => {
    // reference yes,yes,no,no; prediction yes,no,yes,no -> tp 1, fn 1, fp 1
    const r = precisionRecall(["yes", "yes", "no", "no"], ["yes", "no", "yes", "no"]);
    expect([r.tp, r.fp, r.fn]).toEqual([1, 1, 1]);
    expect([r.precision, r.recall]).toEqual([0.5, 0.5]);
  });

  test("undefined", () => {
    const r = precisionRecall(["no"], ["no"]);
    expect(r.precision).toBeNull();
    expect(r.recall).toBeNull();
  });
});
