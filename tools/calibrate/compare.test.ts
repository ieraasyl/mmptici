import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import { defaultChecklist } from "../../apps/api/src/checklist.ts";
import { main } from "./compare.ts";
import { checkLabels, readLabels, scoreAnswers, turns } from "./labels.ts";
import { capture, csvRows, FIXTURES, tempDir } from "./test-helpers.ts";

const LABELS = `${FIXTURES}labels_fake.csv`;
const RUN = `${FIXTURES}run_fake.json`;

function keys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keys);
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => [k, ...keys(v)]);
  }
  return [];
}

function runMain(...args: string[]) {
  const dir = tempDir();
  const c = capture();
  const code = main(
    [...args, "--name", "t", "--reports-dir", `${dir}/r`, "--runs-dir", `${dir}/u`],
    c.io,
  );
  return { code, dir, ...c };
}

function go(...extra: string[]) {
  const r = runMain("--labels", LABELS, "--set", "tuning", ...extra);
  expect(r.code).toBe(0);
  const report = JSON.parse(readFileSync(`${r.dir}/r/t.json`, "utf8"));
  expect(existsSync(`${r.dir}/r/t.md`)).toBe(true);
  return { report, rows: csvRows(`${r.dir}/u/t-mismatches.csv`), dir: r.dir };
}

describe("compare", () => {
  test("pairs", () => {
    const { report, rows } = go("--pairs");
    expect([report.labelerA, report.labelerB]).toEqual(["dauka", "ml-a"]);
    const pc = report.perCriterion;
    // dauka vs ml-a differ on understanding (003), opening/guidance/violations (022),
    // verification/management (025): exact counts out of 3 dialogs.
    expect(pc.opening.exact).toBe(2);
    expect(pc.management.exact).toBe(1);
    expect(pc.empathy.exact).toBe(3);
    expect(report.pooled.exact).toBe(17);
    expect(report.pooled.n).toBe(24);
    // Totals dauka/ml-a: 003 88.13 vs 75.0 (|13.13|); 022 57.5 vs 57.5 (0);
    // 025 55.0 vs 70.5 (15.5). MAE = (13.13 + 0 + 15.5) / 3.
    expect(report.totals.n).toBe(3);
    expect(report.totals.mae).toBeCloseTo(28.63 / 3, 6);
    expect(report.totals.maxError).toBeCloseTo(15.5);
    expect(report.violations.fp).toBe(1);
    expect(report.breakdown.language.RU.n).toBe(24);
    expect(report.breakdown.language.KZ.n).toBe(0);
    expect(report.runHealth).toBeNull();
    expect(report.mismatches).toHaveLength(7);
    expect(rows).toHaveLength(7);
    expect(rows.filter((r) => r.evidence_text)).toHaveLength(7);
    expect(rows.every((r) => r.bucket === "" && r.votes === "")).toBe(true);
    expect(pc.guidance.confusion).toEqual({
      "15": { "15": 1 },
      "10": { "20": 1 },
      "5": { "5": 1 },
    });
    expect(pc.opening).not.toHaveProperty("qwk");
    expect(pc.management).toHaveProperty("qwk");
  });

  test("run", () => {
    const { report, rows, dir } = go("--run", RUN);
    expect(report.run.model).toBe("fake-model");
    const pc = report.perCriterion;
    // "N/A" and string digits in the run file are normalized, so understanding agrees 3/3.
    expect(pc.understanding.exact).toBe(3);
    expect(pc.verification.exact).toBe(2);
    expect(report.pooled.exact).toBe(19);
    // Totals final vs run: 003 88.13 vs 85.5 (2.63); 022 57.5 vs 76.25 (18.75);
    // 025 55.0 vs 50.5 (4.5). MAE = (2.63 + 18.75 + 4.5) / 3.
    expect(report.totals.mae).toBeCloseTo(25.88 / 3, 6);
    expect(report.totals.maxError).toBeCloseTo(18.75);
    const h = report.runHealth;
    expect([h.dialogs, h.failedSamples, h.meanLatencyMs]).toEqual([3, 1, 2000]);
    expect(h.costUsd).toBeCloseTo(0.06);
    expect(h.missingFromRun).toEqual([]);
    expect(rows).toHaveLength(5);
    expect(report.mismatches).toHaveLength(5);
    const v = rows.find((r) => r.criterion_id === "violations")!;
    expect(v.votes).toBe("yes@m1;yes@m2");
    expect(v.explanation).toBe("fake explanation");
    expect(v.evidence_turns).toBe("1;2");
    expect(v.evidence_text).toContain(" | ");
    // Markdown keeps the Python report format, including seeded bootstrap intervals.
    const md = readFileSync(`${dir}/r/t.md`, "utf8");
    expect(md).toContain("- mean latency ms: 2000.0");
    expect(md).toContain('`{"5": {"5": 1}, "10": {"10": 1}, "15": {"10": 1}}`');
  });

  test("reports hold no text fields", () => {
    for (const extra of [["--pairs"], ["--run", RUN]]) {
      const { report } = go(...extra);
      const found = new Set(keys(report));
      for (const k of ["explanation", "note", "text"]) expect(found.has(k)).toBe(false);
    }
  });

  test("invalid labels are reported", () => {
    const rows = readLabels(LABELS, capture().io);
    rows[0].answer = "na"; // opening does not allow na
    rows[1].conversation_id = "nope";
    rows[3] = { ...rows[2] };
    const problems = checkLabels(
      rows,
      defaultChecklist,
      new Set(["p1-ru-003", "p1-ru-022", "p1-ru-025"]),
    );
    expect(problems).toContain("labels_fake.csv row 2: answer 'na' not allowed for opening");
    expect(problems).toContain("labels_fake.csv row 3: unknown conversation 'nope'");
    expect(problems).toContain(
      "labels_fake.csv row 4: duplicate label for ('p1-ru-003', 'dauka', 'verification')",
    );
  });

  test("invalid labels exit 1 and write nothing", () => {
    const dir = tempDir();
    const bad = `${dir}/bad.csv`;
    writeFileSync(
      bad,
      readFileSync(LABELS, "utf8").replace(
        "p1-ru-003,dauka,opening,yes",
        "p1-ru-003,dauka,opening,na",
      ),
    );
    const r = runMain("--labels", bad, "--pairs");
    expect(r.errText()).toContain("row 2: answer 'na' not allowed for opening");
    expect(r.code).toBe(1);
    expect(existsSync(`${r.dir}/r`)).toBe(false);
  });

  test("BOM and surrounding whitespace", () => {
    const dir = tempDir();
    const path = `${dir}/bom.csv`;
    writeFileSync(path, `﻿${readFileSync(LABELS, "utf8").replaceAll(",dauka,", ", dauka ,")}`);
    const rows = readLabels(path, capture().io);
    expect(new Set(rows.map((r) => r.labeler))).toEqual(new Set(["dauka", "ml-a", "final"]));
    expect(rows[0]).toHaveProperty("conversation_id");
  });

  test("quoted commas, escaped quotes, multiline fields, and mixed line endings", () => {
    const dir = tempDir();
    const path = `${dir}/quoted.csv`;
    writeFileSync(
      path,
      "conversation_id,labeler,criterion_id,answer,evidence_turns,note\r\n" +
        'p1-ru-003,dauka,opening,Yes,"1, 2","said ""hi"", then\nleft"\r\n' +
        "\r\n" +
        "p1-ru-003,dauka,closing,N/A,,\n" +
        "p1-ru-003,dauka,empathy,no,,\r",
    );
    const rows = readLabels(path, capture().io);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ answer: "yes", note: 'said "hi", then\nleft', row: 2 });
    expect(turns(rows[0].evidence_turns)).toEqual([1, 2]);
    expect(rows[1]).toMatchObject({ answer: "na", row: 3 });
    expect(rows[2]).toMatchObject({ criterion_id: "empathy", answer: "no", row: 4 });
  });

  test("nothing to compare exits 1 without writing", () => {
    const r = runMain("--labels", LABELS, "--run", RUN, "--labeler", "nobody");
    expect(r.code).toBe(1);
    expect(r.errText()).toContain("nothing to compare");
    expect(r.errText()).toContain("labeler=nobody");
    expect(existsSync(`${r.dir}/r`)).toBe(false);
    expect(existsSync(`${r.dir}/u`)).toBe(false);
  });

  test("run dialogs without ratings are reported missing", () => {
    const run = JSON.parse(readFileSync(RUN, "utf8"));
    delete run.dialogs[0].ratings;
    run.dialogs[1].ratings = null;
    const dir = tempDir();
    writeFileSync(`${dir}/run.json`, JSON.stringify(run));
    const r = runMain("--labels", LABELS, "--run", `${dir}/run.json`, "--set", "tuning");
    expect(r.code).toBe(0);
    const report = JSON.parse(readFileSync(`${r.dir}/r/t.json`, "utf8"));
    expect(report.runHealth.missingFromRun).toEqual(
      expect.arrayContaining([run.dialogs[0].conversationId, run.dialogs[1].conversationId]),
    );
  });

  test("string evidence in a run", () => {
    const run = JSON.parse(readFileSync(RUN, "utf8"));
    for (const d of run.dialogs) for (const r of d.ratings) r.evidence = ["1", "2"];
    const dir = tempDir();
    writeFileSync(`${dir}/run.json`, JSON.stringify(run));
    const r = runMain("--labels", LABELS, "--run", `${dir}/run.json`, "--set", "tuning");
    expect(r.code).toBe(0);
    const rows = csvRows(`${r.dir}/u/t-mismatches.csv`);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.evidence_turns === "1;2")).toBe(true);
  });

  test("several label files and unfinished rows", () => {
    const [header, ...body] = readFileSync(LABELS, "utf8").trimEnd().split("\n");
    const dir = tempDir();
    const a = `${dir}/a.csv`;
    const b = `${dir}/b.csv`;
    writeFileSync(a, [header, ...body.filter((l) => l.includes(",dauka,"))].join("\n") + "\n");
    // One unfinished template row in b: an empty answer.
    const extra = "p1-ru-003,fullstack,opening,,,";
    writeFileSync(
      b,
      [header, ...body.filter((l) => !l.includes(",dauka,")), extra].join("\n") + "\n",
    );
    const r = runMain("--labels", a, b, "--pairs", "--set", "tuning");
    expect(r.code).toBe(0);
    expect(r.errText()).toContain("b.csv: skipped 1 row(s) with an empty answer");
    expect(r.errText()).not.toContain("a.csv");
    const report = JSON.parse(readFileSync(`${r.dir}/r/t.json`, "utf8"));
    expect(report.pooled.n).toBe(24);
    expect(report.pooled.exact).toBe(17);
  });
});

describe("scoring through the app's scorer", () => {
  const answers = {
    opening: "yes",
    understanding: "na",
    verification: "na",
    guidance: 15,
    empathy: "yes",
    management: 7,
    closing: "na",
    violations: "yes",
  } as const;

  test("reference case", () => {
    const result = scoreAnswers(defaultChecklist, answers);
    expect(result.total).toBe(84.17);
    expect(result.seriousViolation).toBe(true);
    expect(result.sections).toEqual([
      { name: "Opening and understanding", earned: 10, weight: 10, score: 100 },
      { name: "Security and resolution", earned: 15, weight: 20, score: 75 },
      { name: "Managing and closing", earned: 25.5, weight: 30, score: 85 },
    ]);
  });

  test("decisions override answers", () => {
    const result = scoreAnswers(defaultChecklist, answers, { guidance: "na", violations: "no" });
    expect(result.total).toBe(88.75);
    expect(result.seriousViolation).toBe(false);
    expect(result.sections[1]).toEqual({
      name: "Security and resolution",
      earned: 0,
      weight: 0,
      score: null,
    });
    const guidance = result.criteria.find((c) => c.criterion.id === "guidance")!;
    expect([guidance.original.answer, guidance.finalAnswer]).toEqual([15, "na"]);
    expect([guidance.originalPoints, guidance.finalPoints]).toEqual([15, null]);
  });

  test("invalid or missing answers are rejected", () => {
    expect(() => scoreAnswers(defaultChecklist, { ...answers, opening: "na" })).toThrow(/opening/);
    const { closing: _, ...missing } = answers;
    expect(() => scoreAnswers(defaultChecklist, missing)).toThrow(/closing/);
    expect(() => scoreAnswers(defaultChecklist, answers, { guidance: 12 })).toThrow(/guidance/);
  });
});
