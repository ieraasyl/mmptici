import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import { main, summarize } from "./summarize-run.ts";
import { capture, tempDir } from "./test-helpers.ts";

function dialog(id: string, lang: string, violation: string, votes?: string[], failed = false) {
  if (failed) {
    return {
      conversationId: id,
      language: lang,
      ratings: [],
      total: null,
      run: { latencyMs: 1000, costUsd: 0.0, calls: 0 },
    };
  }
  return {
    conversationId: id,
    language: lang,
    ratings: [
      { criterionId: "closing", answer: "yes", votes: votes ?? ["yes"] },
      { criterionId: "violations", answer: violation, votes: [violation] },
    ],
    total: 80.0,
    run: { latencyMs: 3000, costUsd: 0.01, calls: 1 },
  };
}

const RUN = {
  promptVersion: "p-test",
  provider: "hf-router",
  model: "m",
  set: "dev",
  samples: 3,
  temperature: 0.6,
  commit: "abc",
  dialogs: [
    dialog("p1-ru-022", "RU", "yes", ["yes", "yes", "yes"]),
    dialog("p1-ru-023", "RU", "no", ["yes", "no", "yes"]),
    dialog("p1-en-001", "EN", "yes"),
    dialog("p1-kz-001", "KZ", "no", undefined, true),
  ],
};

describe("summarize-run", () => {
  test("counts failures and the answer distribution", () => {
    const s = summarize(RUN);
    expect(s.evaluated).toBe(3);
    expect(s.failed).toEqual(["p1-kz-001"]);
    expect(s.distribution.violations).toEqual({ yes: 2, no: 1 });
    expect(s.byLanguage.violations.RU).toEqual({ yes: 1, no: 1 });
  });

  test("violation flags against the team's known cases", () => {
    const v = summarize(RUN).violations;
    expect(v.flagged).toEqual(["p1-en-001", "p1-ru-022"]);
    expect(v.knownCaught).toEqual(["p1-ru-022"]);
    expect(v.knownMissed).toEqual(["p1-ru-023"]);
    expect(v.unexpected).toEqual(["p1-en-001"]);
  });

  test("stability counts unanimous rows with several votes", () => {
    // Closing has three votes in p1-ru-022 (all yes) and p1-ru-023 (yes, no, yes);
    // p1-en-001 has a single vote and is not counted.
    const st = summarize(RUN).stability!.closing;
    expect([st.n, st.unanimous]).toEqual([2, 1]);
  });

  test("cost and totals", () => {
    const s = summarize(RUN);
    expect(s.cost.calls).toBe(3);
    expect(s.cost.totalUsd).toBeCloseTo(0.03);
    expect(s.totals.mean).toBe(80);
  });

  test("new run files count requests and flag missing usage", () => {
    const run = structuredClone(RUN);
    run.dialogs[0].run = { ...run.dialogs[0].run, requests: 4, responsesWithoutUsage: 1 } as never;
    const s = summarize(run);
    expect(s.cost.calls).toBe(6);
    expect(s.cost.responsesWithoutUsage).toBe(1);
    expect(summarize(RUN).cost).not.toHaveProperty("responsesWithoutUsage");
  });

  test("reports hold no text fields", () => {
    const dir = tempDir();
    writeFileSync(`${dir}/run.json`, JSON.stringify(RUN));
    const c = capture();
    expect(main([`${dir}/run.json`, "--name", "t", "--reports-dir", dir], c.io)).toBe(0);
    expect(c.out).toEqual([`${dir}/t.json`, `${dir}/t.md`]);
    expect(readFileSync(`${dir}/t.json`, "utf8")).not.toContain("explanation");
    const md = readFileSync(`${dir}/t.md`, "utf8");
    expect(md).toContain("- Totals: n=3, mean 80, min 80, max 80");
    expect(md).toContain("- Cost $0.03 over 3 model calls, mean 2.5 s per dialog");
  });
});
